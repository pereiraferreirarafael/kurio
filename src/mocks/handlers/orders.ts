import { HttpResponse, delay, http } from 'msw'
import {
  IDEMPOTENCY_HEADER,
  type Order,
  type WalletConnection,
  createOrderBodySchema,
  walletConnectBodySchema,
} from '@/api/contracts'
import { type OrderRecord, getDb, saveDb } from '../db'
import { activeScenario } from '../scenarios'
import { buildQuote } from '../pricing'
import { DEFAULT_SETTLE_MS, findOrder, fnv, scheduleSettle, settleIfDue } from '../orders'
import { apiError, apiPath, authenticate, gate } from './common'

function publicOrder({ userId: _u, settleAt: _s, outcome: _o, ...order }: OrderRecord): Order {
  return order
}

/** Conteúdo que define "o mesmo pedido" para a chave de idempotência. */
function contentHash(body: ReturnType<typeof createOrderBodySchema.parse>) {
  const items = [...body.items].sort((a, b) => a.editionId.localeCompare(b.editionId))
  return fnv(JSON.stringify([items, body.coupon ?? null, body.network, body.walletAddress, body.quoteFingerprint]), 16)
}

export const orderHandlers = [
  // Conexão simulada da carteira: endereço determinístico por usuário e rede.
  http.post(apiPath('/wallet/connect'), async ({ request }) => {
    const blocked = await gate('wallet')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const body = walletConnectBodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return apiError(422, 'VALIDATION_ERROR', 'Rede inválida.', { network: 'Escolha uma rede.' })
    const connection: WalletConnection = {
      network: body.data.network,
      address: `0x${fnv(`${auth.user.id}:${body.data.network}`, 40)}`,
    }
    return HttpResponse.json(connection)
  }),

  http.post(apiPath('/orders'), async ({ request }) => {
    const blocked = await gate('order-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response

    const key = request.headers.get(IDEMPOTENCY_HEADER)
    if (!key || key.length < 8) {
      return apiError(422, 'VALIDATION_ERROR', `O cabeçalho ${IDEMPOTENCY_HEADER} é obrigatório.`)
    }
    const parsed = createOrderBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Pedido inválido.')
    const body = parsed.data
    const db = getDb()
    const hash = contentHash(body)
    const stored = db.idempotency[`${auth.user.id}:${key}`]

    if (stored) {
      if (stored.hash !== hash) {
        return apiError(409, 'CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.', {
          reason: 'IDEMPOTENCY_MISMATCH',
        })
      }
      const existing = findOrder(stored.orderId)!
      return HttpResponse.json(publicOrder(settleIfDue(existing)), { headers: { 'Idempotent-Replay': 'true' } })
    }

    // Revalida tudo no servidor antes de criar: preço, disponibilidade, cupom e taxa.
    const quote = buildQuote(db.nfts, body.items, body.coupon)
    if (!quote.canCheckout) {
      return apiError(409, 'CONFLICT', quote.issues[0]?.message ?? 'Itens indisponíveis.', { reason: 'UNAVAILABLE' })
    }
    if (quote.fingerprint !== body.quoteFingerprint) {
      return apiError(409, 'CONFLICT', 'Os valores do pedido mudaram. Revise e confirme novamente.', {
        reason: 'QUOTE_CHANGED',
      })
    }

    const scenario = activeScenario()
    const now = Date.now()
    const id = `ord_${fnv(`${auth.user.id}:${key}`, 10)}`
    const order: OrderRecord = {
      id,
      userId: auth.user.id,
      status: 'pending',
      version: 1,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      network: body.network,
      walletAddress: body.walletAddress,
      quote,
      declineReason: null,
      txHash: null,
      settleAt: now + (scenario.orderSettleMs ?? DEFAULT_SETTLE_MS),
      outcome: scenario.orderOutcome ?? 'confirm',
    }
    db.orders.push(order)
    db.idempotency[`${auth.user.id}:${key}`] = { hash, orderId: id }
    saveDb()
    scheduleSettle(order)

    // A resposta se perde DEPOIS de o pedido existir: o cliente deve repetir com a mesma chave.
    if (scenario.orderHangAfterCreate) await delay('infinite')
    return HttpResponse.json(publicOrder(order), { status: 201 })
  }),

  http.get(apiPath('/orders'), async ({ request }) => {
    const blocked = await gate('order-read')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const items = getDb()
      .orders.filter((o) => o.userId === auth.user.id)
      .map((o) => publicOrder(settleIfDue(o)))
      .reverse()
    return HttpResponse.json({ items })
  }),

  http.get(apiPath('/orders/:orderId'), async ({ request, params }) => {
    const blocked = await gate('order-read')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const order = findOrder(String(params.orderId))
    // Pedido de outro usuário é indistinguível de pedido inexistente.
    if (!order || order.userId !== auth.user.id) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json(publicOrder(settleIfDue(order)))
  }),
]
