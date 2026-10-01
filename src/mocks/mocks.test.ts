import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiClient } from '@/api/client'
import type { Nft } from '@/api/contracts'
import { compareEth } from '@/lib/money'
import { emitNftUpdate, mockControl } from './control'
import { getDb, resetDb } from './db'
import { DEMO_CREDENTIALS } from './fixtures'
import { restHandlers } from './handlers'
import { clearOrderTimers } from './orders'
import { resetScenarioClock, setScenarioName } from './scenarios'
import { connectedClients, realtimeHandlers } from './socket'

const server = setupServer(...restHandlers, ...realtimeHandlers)
const client = createApiClient('http://localhost/api')
const { email, password } = DEMO_CREDENTIALS[0]
const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

async function waitFor(condition: () => boolean, timeoutMs = 3000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout aguardando condição')
    await new Promise((r) => setTimeout(r, 10))
  }
}

async function loginToken(): Promise<string> {
  const { data } = await client.post('/auth/login', { email, password })
  return data.token as string
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  clearOrderTimers()
  resetDb()
  resetScenarioClock()
  setScenarioName('default')
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('catálogo', () => {
  it('pagina 36 NFTs em 4 páginas de 9', async () => {
    const { data } = await client.get('/nfts')
    expect(data).toMatchObject({ total: 36, pageSize: 9, totalPages: 4, page: 1 })
    expect(data.items).toHaveLength(9)
  })

  it('combina filtros e ordena por preço sem perder precisão', async () => {
    const { data } = await client.get('/nfts', {
      params: { collection: 'kurio-apes', network: 'ethereum', sort: 'price_asc' },
    })
    const items = data.items as Nft[]
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((n) => n.collectionSlug === 'kurio-apes' && n.network === 'ethereum')).toBe(true)
    for (let i = 1; i < items.length; i++) {
      expect(compareEth(items[i - 1]!.price, items[i]!.price)).toBeLessThanOrEqual(0)
    }
  })

  it('busca ignora acentos e caixa', async () => {
    const { data } = await client.get('/nfts', { params: { q: 'EMERALD' } })
    expect(data.items[0].name).toBe('Emerald Ape #042')
  })

  it('cenário empty devolve catálogo vazio', async () => {
    setScenarioName('empty')
    const { data } = await client.get('/nfts')
    expect(data).toMatchObject({ total: 0, items: [] })
  })

  it('cenário error-500 devolve falha transitória', async () => {
    setScenarioName('error-500')
    await expect(client.get('/nfts')).rejects.toMatchObject({ kind: 'TRANSIENT', status: 500 })
  })

  it('NFT inexistente responde 404 tipado', async () => {
    await expect(client.get('/nfts/nao-existe')).rejects.toMatchObject({ kind: 'NOT_FOUND', status: 404 })
  })
})

describe('sessão e favoritos', () => {
  it('rejeita credenciais erradas e aceita as corretas', async () => {
    await expect(client.post('/auth/login', { email, password: 'errada' })).rejects.toMatchObject({
      kind: 'UNAUTHENTICATED',
    })
    const token = await loginToken()
    const { data } = await client.get('/session', bearer(token))
    expect(data.user.email).toBe(email)
    expect(data.user).not.toHaveProperty('passwordHash')
  })

  it('cadastro valida campos e trata conflito de e-mail', async () => {
    await expect(
      client.post('/auth/signup', { username: 'x', email: 'invalido', password: '123', confirmPassword: '1' }),
    ).rejects.toMatchObject({ kind: 'VALIDATION_ERROR', status: 422 })
    await expect(
      client.post('/auth/signup', { username: 'novo', email, password: 'Senha@1234', confirmPassword: 'Senha@1234' }),
    ).rejects.toMatchObject({ kind: 'CONFLICT', status: 409, fields: { email: expect.any(String) } })
  })

  it('não guarda senha em claro no estado', () => {
    expect(JSON.stringify(getDb().users)).not.toContain(password)
  })

  it('favoritos exigem sessão e ficam isolados por usuário', async () => {
    await expect(client.get('/favorites')).rejects.toMatchObject({ kind: 'UNAUTHENTICATED' })
    const ana = await loginToken()
    await client.put('/favorites/emerald-ape-042', undefined, bearer(ana))
    const bruno = (await client.post('/auth/login', { email: 'bruno@kurio.dev', password: 'Kurio@456' })).data.token as string
    expect((await client.get('/favorites', bearer(ana))).data.nftIds).toEqual(['emerald-ape-042'])
    expect((await client.get('/favorites', bearer(bruno))).data.nftIds).toEqual([])
  })

  it('cenário favorites-fail faz a mutation falhar (base do rollback)', async () => {
    const token = await loginToken()
    setScenarioName('favorites-fail')
    await expect(client.put('/favorites/emerald-ape-042', undefined, bearer(token))).rejects.toMatchObject({ kind: 'TRANSIENT' })
  })

  it('cenário session-expired devolve SESSION_EXPIRED', async () => {
    const token = await loginToken()
    setScenarioName('session-expired')
    await expect(client.get('/session', bearer(token))).rejects.toMatchObject({ kind: 'SESSION_EXPIRED' })
  })
})

describe('carrinho, cotação e cupom', () => {
  const figmaItems = [
    { nftId: 'emerald-ape-042', editionId: 'emerald-ape-042-e3', quantity: 2 },
    { nftId: 'violet-nomad-314', editionId: 'violet-nomad-314-e3', quantity: 6 },
    { nftId: 'ivory-baron-088', editionId: 'ivory-baron-088-e3', quantity: 9 },
  ]
  beforeEach(() => {
    // Estoque determinístico para as contas do Figma.
    for (const item of figmaItems) {
      const edition = getDb().nfts.find((n) => n.id === item.nftId)!.editions.find((e) => e.id === item.editionId)!
      edition.available = 20
    }
  })

  it('reproduz a conta do Figma e soma sem erro de ponto flutuante', async () => {
    const { data } = await client.post('/quote', { items: figmaItems })
    expect(data.lines.map((l: { lineTotal: string }) => l.lineTotal)).toEqual(['2.38', '8.34', '16.11'])
    expect(data).toMatchObject({ subtotal: '26.83', discount: '0', networkFee: '0.016', total: '26.846', canCheckout: true })
  })

  it('aplica cupom percentual e recalcula o total', async () => {
    const { data } = await client.post('/quote', { items: figmaItems, coupon: 'KURIO10' })
    expect(data.discount).toBe('2.683')
    expect(data.total).toBe('24.163')
    expect(data.coupon).toMatchObject({ code: 'KURIO10', status: 'applied' })
  })

  it('rejeita cupom inválido e expirado com erro de campo', async () => {
    const token = await loginToken()
    await expect(client.put('/cart/coupon', { code: 'NAOEXISTE' }, bearer(token))).rejects.toMatchObject({
      kind: 'VALIDATION_ERROR',
      fields: { coupon: 'Cupom inválido.' },
    })
    await expect(client.put('/cart/coupon', { code: 'EXPIRADO20' }, bearer(token))).rejects.toMatchObject({
      fields: { coupon: 'Este cupom expirou.' },
    })
  })

  it('bloqueia quantidade acima do estoque (409) e marca a cotação como não finalizável', async () => {
    const token = await loginToken()
    const item = figmaItems[0]!
    getDb().nfts.find((n) => n.id === item.nftId)!.editions.find((e) => e.id === item.editionId)!.available = 1
    await expect(
      client.put(`/cart/items/${item.editionId}`, { nftId: item.nftId, quantity: 2 }, bearer(token)),
    ).rejects.toMatchObject({ kind: 'CONFLICT' })
    const { data } = await client.post('/quote', { items: [item] })
    expect(data.canCheckout).toBe(false)
    expect(data.issues[0]).toMatchObject({ type: 'exceeds_stock' })
  })

  it('mescla o carrinho de visitante ao do usuário somando e limitando ao estoque', async () => {
    const token = await loginToken()
    const item = figmaItems[0]!
    await client.put(`/cart/items/${item.editionId}`, { nftId: item.nftId, quantity: 15 }, bearer(token))
    const { data } = await client.post('/cart/merge', { items: [{ ...item, quantity: 10 }], coupon: 'KURIO10' }, bearer(token))
    expect(data.items).toEqual([{ ...item, quantity: 20 }])
    expect(data.coupon).toBe('KURIO10')
  })

  it('isola o carrinho por usuário', async () => {
    const ana = await loginToken()
    const bruno = (await client.post('/auth/login', { email: 'bruno@kurio.dev', password: 'Kurio@456' })).data.token as string
    const item = figmaItems[0]!
    await client.put(`/cart/items/${item.editionId}`, { nftId: item.nftId, quantity: 1 }, bearer(ana))
    expect((await client.get('/cart', bearer(ana))).data.items).toHaveLength(1)
    expect((await client.get('/cart', bearer(bruno))).data.items).toHaveLength(0)
    await expect(client.get('/cart')).rejects.toMatchObject({ kind: 'UNAUTHENTICATED' })
  })

  it('cenário cart-fail faz a escrita falhar e quote-503 a cotação', async () => {
    const token = await loginToken()
    const item = figmaItems[0]!
    setScenarioName('cart-fail')
    await expect(
      client.put(`/cart/items/${item.editionId}`, { nftId: item.nftId, quantity: 1 }, bearer(token)),
    ).rejects.toMatchObject({ kind: 'TRANSIENT' })
    setScenarioName('quote-503')
    await expect(client.post('/quote', { items: [item] })).rejects.toMatchObject({ kind: 'TRANSIENT' })
  })
})

describe('checkout idempotente e pedidos', () => {
  const item = { nftId: 'emerald-ape-042', editionId: 'emerald-ape-042-e3', quantity: 2 }
  const other = { nftId: 'sage-nomad-009', editionId: 'sage-nomad-009-e3', quantity: 1 }
  beforeEach(() => {
    for (const i of [item, other]) {
      getDb().nfts.find((n) => n.id === i.nftId)!.editions.find((e) => e.id === i.editionId)!.available = 20
    }
  })

  async function orderBody(items = [item], coupon: string | null = null) {
    const { data } = await client.post('/quote', { items, coupon })
    return {
      items,
      coupon,
      quoteFingerprint: data.fingerprint as string,
      network: 'ethereum',
      walletAddress: '0xabc',
    }
  }
  const idem = (key: string, extra: object = {}) => ({ headers: { 'Idempotency-Key': key }, ...extra })
  const place = (token: string, body: object, key = 'key-00000001', extra: object = {}) =>
    client.post('/orders', body, {
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
      ...extra,
    })

  it('exige Idempotency-Key e sessão', async () => {
    const token = await loginToken()
    await expect(client.post('/orders', await orderBody(), bearer(token))).rejects.toMatchObject({ kind: 'VALIDATION_ERROR' })
    await expect(client.post('/orders', await orderBody(), idem('key-00000001'))).rejects.toMatchObject({ kind: 'UNAUTHENTICATED' })
  })

  it('mesma chave e mesmo conteúdo devolvem o mesmo pedido, sem duplicar', async () => {
    const token = await loginToken()
    const body = await orderBody()
    const a = await place(token, body)
    const b = await place(token, body)
    expect(a.status).toBe(201)
    expect(b.data.id).toBe(a.data.id)
    expect(getDb().orders).toHaveLength(1)
  })

  it('mesma chave com conteúdo diferente é 409 IDEMPOTENCY_MISMATCH', async () => {
    const token = await loginToken()
    await place(token, await orderBody())
    await expect(place(token, await orderBody([{ ...item, quantity: 1 }]))).rejects.toMatchObject({
      kind: 'CONFLICT',
      fields: { reason: 'IDEMPOTENCY_MISMATCH' },
    })
    expect(getDb().orders).toHaveLength(1)
  })

  it('pedido nasce pendente e só é confirmado pela simulação', async () => {
    const token = await loginToken()
    const { data: created } = await place(token, await orderBody())
    expect(created).toMatchObject({ status: 'pending', txHash: null, version: 1 })
    expect((await client.get(`/orders/${created.id}`, bearer(token))).data.status).toBe('pending')

    mockControl.settleOrder(created.id, 'confirm')
    const { data } = await client.get(`/orders/${created.id}`, bearer(token))
    expect(data).toMatchObject({ status: 'confirmed', version: 2 })
    expect(data.txHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(data.quote.total).toBe('2.396')
  })

  it('confirmação baixa o estoque e remove do carrinho só o que foi comprado', async () => {
    const token = await loginToken()
    await client.put(`/cart/items/${item.editionId}`, { nftId: item.nftId, quantity: 3 }, bearer(token))
    await client.put(`/cart/items/${other.editionId}`, { nftId: other.nftId, quantity: 1 }, bearer(token))
    const { data: created } = await place(token, await orderBody())
    mockControl.settleOrder(created.id, 'confirm')

    const cart = (await client.get('/cart', bearer(token))).data
    expect(cart.items).toEqual(
      expect.arrayContaining([
        { ...item, quantity: 1 },
        { ...other },
      ]),
    )
    const edition = getDb().nfts.find((n) => n.id === item.nftId)!.editions.find((e) => e.id === item.editionId)!
    expect(edition.available).toBe(18)
  })

  it('pedido recusado preserva carrinho e estoque', async () => {
    const token = await loginToken()
    await client.put(`/cart/items/${item.editionId}`, { nftId: item.nftId, quantity: 2 }, bearer(token))
    const { data: created } = await place(token, await orderBody())
    mockControl.settleOrder(created.id, 'decline')
    const { data } = await client.get(`/orders/${created.id}`, bearer(token))
    expect(data).toMatchObject({ status: 'declined', txHash: null })
    expect(data.declineReason).toBeTruthy()
    expect((await client.get('/cart', bearer(token))).data.items).toHaveLength(1)
    expect(getDb().nfts.find((n) => n.id === item.nftId)!.editions.find((e) => e.id === item.editionId)!.available).toBe(20)
  })

  it('estoque que some antes da confirmação recusa o pedido', async () => {
    const token = await loginToken()
    const { data: created } = await place(token, await orderBody())
    getDb().nfts.find((n) => n.id === item.nftId)!.editions.find((e) => e.id === item.editionId)!.available = 1
    mockControl.settleOrder(created.id, 'confirm')
    expect((await client.get(`/orders/${created.id}`, bearer(token))).data.status).toBe('declined')
  })

  it('revalida no servidor: preço alterado responde 409 QUOTE_CHANGED e não cria pedido', async () => {
    const token = await loginToken()
    const body = await orderBody()
    emitNftUpdate(item.nftId, { price: '2.00' })
    await expect(place(token, body)).rejects.toMatchObject({ kind: 'CONFLICT', fields: { reason: 'QUOTE_CHANGED' } })
    expect(getDb().orders).toHaveLength(0)
  })

  it('item esgotado responde 409 UNAVAILABLE', async () => {
    const token = await loginToken()
    const body = await orderBody()
    emitNftUpdate(item.nftId, { availability: { [item.editionId]: 0 } })
    await expect(place(token, body)).rejects.toMatchObject({ kind: 'CONFLICT', fields: { reason: 'UNAVAILABLE' } })
  })

  it('pedidos são privados: outro usuário recebe 404 e lista vazia', async () => {
    const ana = await loginToken()
    const bruno = (await client.post('/auth/login', { email: 'bruno@kurio.dev', password: 'Kurio@456' })).data.token as string
    const { data: created } = await place(ana, await orderBody())
    await expect(client.get(`/orders/${created.id}`, bearer(bruno))).rejects.toMatchObject({ kind: 'NOT_FOUND' })
    expect((await client.get('/orders', bearer(bruno))).data.items).toEqual([])
    expect((await client.get('/orders', bearer(ana))).data.items).toHaveLength(1)
  })

  it('timeout depois da criação: repetir com a mesma chave recupera o mesmo pedido', async () => {
    const token = await loginToken()
    const body = await orderBody()
    setScenarioName('order-timeout-after-create')
    await expect(place(token, body, 'key-timeout-1', { timeout: 400 })).rejects.toMatchObject({ kind: 'TIMEOUT' })
    expect(getDb().orders).toHaveLength(1)
    setScenarioName('default')
    const retry = await place(token, body, 'key-timeout-1')
    expect(retry.data.id).toBe(getDb().orders[0]!.id)
    expect(getDb().orders).toHaveLength(1)
  })

  it('cenários order-create-fails e wallet-refused', async () => {
    const token = await loginToken()
    const body = await orderBody()
    setScenarioName('order-create-fails')
    await expect(place(token, body)).rejects.toMatchObject({ kind: 'TRANSIENT' })
    expect(getDb().orders).toHaveLength(0)
    setScenarioName('wallet-refused')
    await expect(client.post('/wallet/connect', { network: 'ethereum' }, bearer(token))).rejects.toMatchObject({ kind: 'FORBIDDEN' })
    setScenarioName('default')
    const { data } = await client.post('/wallet/connect', { network: 'ethereum' }, bearer(token))
    expect(data.address).toMatch(/^0x[0-9a-f]{40}$/)
  })

  it('expiração de sessão durante o pedido responde SESSION_EXPIRED', async () => {
    const token = await loginToken()
    const body = await orderBody()
    setScenarioName('session-expired')
    await expect(place(token, body)).rejects.toMatchObject({ kind: 'SESSION_EXPIRED' })
  })
})

describe('perfil e carteiras', () => {
  const bruno = async () =>
    (await client.post('/auth/login', { email: 'bruno@kurio.dev', password: 'Kurio@456' })).data.token as string

  it('atualiza dados do perfil e recusa e-mail/usuário de outra conta', async () => {
    const token = await loginToken()
    const { data } = await client.patch('/profile', { displayName: 'Ana S.', username: 'ana', email: 'ana2@kurio.dev' }, bearer(token))
    expect(data.user).toMatchObject({ displayName: 'Ana S.', email: 'ana2@kurio.dev' })
    expect((await client.get('/session', bearer(token))).data.user.displayName).toBe('Ana S.')
    await expect(
      client.patch('/profile', { displayName: 'Ana', username: 'bruno', email: 'bruno@kurio.dev' }, bearer(token)),
    ).rejects.toMatchObject({
      kind: 'CONFLICT',
      fields: { email: 'Este e-mail já está cadastrado.', username: 'Este nome de usuário já está em uso.' },
    })
    await expect(client.patch('/profile', { displayName: 'A', username: 'an', email: 'x' }, bearer(token))).rejects.toMatchObject({
      kind: 'VALIDATION_ERROR',
    })
  })

  it('avatar aceita imagem pequena, rejeita tipo inválido e pode ser removido', async () => {
    const token = await loginToken()
    const ok = 'data:image/png;base64,iVBORw0KGgo='
    expect((await client.put('/profile/avatar', { dataUrl: ok }, bearer(token))).data.user.avatarUrl).toBe(ok)
    await expect(client.put('/profile/avatar', { dataUrl: 'data:text/html;base64,PGI+' }, bearer(token))).rejects.toMatchObject({
      kind: 'VALIDATION_ERROR',
    })
    await expect(
      client.put('/profile/avatar', { dataUrl: `data:image/png;base64,${'A'.repeat(400_000)}` }, bearer(token)),
    ).rejects.toMatchObject({ kind: 'VALIDATION_ERROR' })
    expect((await client.delete('/profile/avatar', bearer(token))).data.user.avatarUrl).toBeNull()
  })

  it('troca de senha exige a atual e passa a valer no login', async () => {
    const token = await loginToken()
    const body = { currentPassword: 'errada', newPassword: 'NovaSenha@1', confirmPassword: 'NovaSenha@1' }
    await expect(client.post('/profile/password', body, bearer(token))).rejects.toMatchObject({
      fields: { currentPassword: 'A senha atual está incorreta.' },
    })
    await client.post('/profile/password', { ...body, currentPassword: password }, bearer(token))
    await expect(client.post('/auth/login', { email, password })).rejects.toMatchObject({ kind: 'UNAUTHENTICATED' })
    expect((await client.post('/auth/login', { email, password: 'NovaSenha@1' })).data.token).toBeTruthy()
    expect(JSON.stringify(getDb().users)).not.toContain('NovaSenha@1')
  })

  it('carteiras: a primeira vira principal e só existe uma principal por vez', async () => {
    const token = await loginToken()
    const add = (label: string, network = 'ethereum') => client.post('/wallets', { network, label }, bearer(token))
    const first = (await add('Principal')).data.items
    expect(first).toHaveLength(1)
    expect(first[0].isPrimary).toBe(true)
    const second = (await add('Reserva', 'polygon')).data.items
    expect(second.filter((w: { isPrimary: boolean }) => w.isPrimary)).toHaveLength(1)
    const swapped = (await client.put(`/wallets/${second[1].id}/primary`, undefined, bearer(token))).data.items
    expect(swapped.map((w: { isPrimary: boolean }) => w.isPrimary)).toEqual([false, true])
  })

  it('carteiras: não remove a principal com outras existentes, respeita limite e nomes únicos', async () => {
    const token = await loginToken()
    const add = (label: string) => client.post('/wallets', { network: 'solana', label }, bearer(token))
    const [a] = (await add('A')).data.items
    const list = (await add('B')).data.items
    await expect(client.delete(`/wallets/${a.id}`, bearer(token))).rejects.toMatchObject({ fields: { reason: 'PRIMARY' } })
    await expect(add('b')).rejects.toMatchObject({ fields: { label: 'Já existe uma carteira com este nome.' } })
    await client.delete(`/wallets/${list[1].id}`, bearer(token))
    for (const l of ['C', 'D', 'E', 'F']) await add(l)
    await expect(add('G')).rejects.toMatchObject({ kind: 'CONFLICT', fields: { reason: 'LIMIT' } })
  })

  it('carteiras e perfil são privados por usuário', async () => {
    const ana = await loginToken()
    await client.post('/wallets', { network: 'ethereum', label: 'Minha' }, bearer(ana))
    const b = await bruno()
    expect((await client.get('/wallets', bearer(b))).data.items).toEqual([])
    const id = (await client.get('/wallets', bearer(ana))).data.items[0].id
    await expect(client.put(`/wallets/${id}/primary`, undefined, bearer(b))).rejects.toMatchObject({ kind: 'NOT_FOUND' })
    await expect(client.delete(`/wallets/${id}`, bearer(b))).rejects.toMatchObject({ kind: 'NOT_FOUND' })
    await expect(client.get('/wallets')).rejects.toMatchObject({ kind: 'UNAUTHENTICATED' })
  })

  it('cenário account-fail faz escritas falharem sem alterar dados', async () => {
    const token = await loginToken()
    setScenarioName('account-fail')
    await expect(client.post('/wallets', { network: 'ethereum', label: 'X' }, bearer(token))).rejects.toMatchObject({ kind: 'TRANSIENT' })
    await expect(client.patch('/profile', { displayName: 'Zed', username: 'zed', email: 'z@kurio.dev' }, bearer(token))).rejects.toMatchObject({ kind: 'TRANSIENT' })
    setScenarioName('default')
    expect((await client.get('/wallets', bearer(token))).data.items).toEqual([])
  })
})

describe('Socket.IO simulado', () => {
  async function openSocket() {
    const messages: string[] = []
    const socket = new WebSocket('ws://localhost:3000/kurio-rt/?EIO=4&transport=websocket')
    socket.addEventListener('message', (e) => messages.push(String(e.data)))
    await waitFor(() => messages.length >= 2)
    return { socket, messages }
  }

  it('faz o handshake do Engine.IO e entrega nft.updated com o mesmo estado do REST', async () => {
    const { socket, messages } = await openSocket()
    try {
      expect(messages[0]).toMatch(/^0\{/)
      expect(messages[1]).toMatch(/^40/)
      expect(connectedClients()).toBe(1)

      const event = emitNftUpdate('emerald-ape-042', { price: '2.50' })
      await waitFor(() => messages.some((m) => m.startsWith('42["nft.updated"')))
      const payload = JSON.parse(messages.find((m) => m.startsWith('42["nft.updated"'))!.slice(2))[1]
      expect(payload).toMatchObject({ eventId: event.eventId, version: 2, data: { price: '2.50' } })

      const { data } = await client.get('/nfts/emerald-ape-042')
      expect(data).toMatchObject({ price: '2.50', version: 2 })
    } finally {
      socket.close()
      await waitFor(() => connectedClients() === 0)
    }
  })

  it('reproduz eventos duplicados e antigos sob demanda', async () => {
    const { socket, messages } = await openSocket()
    try {
      const count = () => messages.filter((m) => m.startsWith('42["nft.updated"')).length
      emitNftUpdate('sage-nomad-009', { price: '3.00' }, { duplicate: true })
      await waitFor(() => count() === 2)
      const [a, b] = messages.filter((m) => m.startsWith('42[')).map((m) => JSON.parse(m.slice(2))[1])
      expect(a.eventId).toBe(b.eventId)

      const stale = emitNftUpdate('sage-nomad-009', {}, { stale: true })
      expect(stale.version).toBeLessThan(getDb().nfts.find((n) => n.id === 'sage-nomad-009')!.version)
    } finally {
      socket.close()
      await waitFor(() => connectedClients() === 0)
    }
  })

  it('order.updated chega só ao dono do pedido (autenticado no handshake)', async () => {
    const ana = await loginToken()
    const bruno = (await client.post('/auth/login', { email: 'bruno@kurio.dev', password: 'Kurio@456' })).data.token as string
    const open = async (token: string) => {
      const { socket, messages } = await openSocket()
      socket.send(`40${JSON.stringify({ token })}`)
      return { socket, messages }
    }
    const a = await open(ana)
    const b = await open(bruno)
    try {
      getDb().nfts[0]!.editions[2]!.available = 20
      const { data: quote } = await client.post('/quote', {
        items: [{ nftId: 'emerald-ape-042', editionId: 'emerald-ape-042-e3', quantity: 1 }],
      })
      const { data: created } = await client.post(
        '/orders',
        {
          items: [{ nftId: 'emerald-ape-042', editionId: 'emerald-ape-042-e3', quantity: 1 }],
          quoteFingerprint: quote.fingerprint,
          network: 'ethereum',
          walletAddress: '0xabc',
        },
        { headers: { Authorization: `Bearer ${ana}`, 'Idempotency-Key': 'key-socket-01' } },
      )
      await new Promise((r) => setTimeout(r, 50))
      mockControl.settleOrder(created.id, 'confirm')
      const got = (m: string[]) => m.filter((x) => x.startsWith('42["order.updated"'))
      await waitFor(() => got(a.messages).length === 1)
      await new Promise((r) => setTimeout(r, 100))
      expect(got(b.messages)).toHaveLength(0)
      expect(JSON.parse(got(a.messages)[0]!.slice(2))[1]).toMatchObject({
        resource: { id: created.id },
        version: 2,
        data: { status: 'confirmed' },
      })
    } finally {
      a.socket.close()
      b.socket.close()
      await waitFor(() => connectedClients() === 0)
    }
  })
})
