import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Nft, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { nftKeys } from '@/api/nfts'
import { buildNfts } from '@/mocks/fixtures'
import { applyNftUpdated, applyOrderUpdated, createEventTracker } from './events'

let qc: QueryClient
let nft: Nft

function event(eventId: string, version: number, price: string): NftUpdatedEvent {
  return {
    eventId,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version,
    occurredAt: new Date().toISOString(),
    data: { price, previousPrice: nft.price, editions: nft.editions.map((e) => ({ id: e.id, available: 0 })) },
  }
}

beforeEach(() => {
  qc = new QueryClient()
  nft = buildNfts()[0]!
  qc.setQueryData(nftKeys.detail(nft.id), nft)
})

describe('applyNftUpdated', () => {
  it('aplica versão mais nova ao cache do detalhe', () => {
    const tracker = createEventTracker()
    expect(applyNftUpdated(qc, event('e1', 2, '2.50'), tracker)).toBe('applied')
    const cached = qc.getQueryData<Nft>(nftKeys.detail(nft.id))!
    expect(cached.price).toBe('2.50')
    expect(cached.version).toBe(2)
    expect(cached.editions.every((e) => e.available === 0)).toBe(true)
  })

  it('ignora duplicatas pelo eventId', () => {
    const tracker = createEventTracker()
    expect(applyNftUpdated(qc, event('e1', 2, '2.50'), tracker)).toBe('applied')
    expect(applyNftUpdated(qc, event('e1', 2, '2.50'), tracker)).toBe('duplicate')
  })

  it('não regride para uma versão antiga', () => {
    const tracker = createEventTracker()
    applyNftUpdated(qc, event('e2', 3, '3.00'), tracker)
    expect(applyNftUpdated(qc, event('e1', 2, '2.50'), tracker)).toBe('stale')
    expect(qc.getQueryData<Nft>(nftKeys.detail(nft.id))!.price).toBe('3.00')
  })

  it('rejeita payload fora do contrato', () => {
    expect(applyNftUpdated(qc, { foo: 'bar' }, createEventTracker())).toBe('invalid')
  })
})

describe('applyOrderUpdated', () => {
  const key = ['user', 'u_1', 'orders', 'ord_1'] as const
  const cartKey = ['user', 'u_1', 'cart'] as const
  const base = {
    id: 'ord_1',
    status: 'pending',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    network: 'ethereum',
    walletAddress: '0xabc',
    declineReason: null,
    txHash: null,
  } as unknown as Order
  const orderEvent = (eventId: string, version: number, status: OrderUpdatedEvent['data']['status']): OrderUpdatedEvent => ({
    eventId,
    type: 'order.updated',
    resource: { type: 'order', id: 'ord_1' },
    version,
    occurredAt: new Date().toISOString(),
    data: { status, declineReason: null, txHash: status === 'confirmed' ? '0xtx' : null },
  })

  beforeEach(() => {
    qc.setQueryData(key, base)
    qc.setQueryData(cartKey, { items: [], coupon: null })
  })

  it('confirma o pedido em cache e revalida o carrinho', () => {
    const tracker = createEventTracker()
    expect(applyOrderUpdated(qc, orderEvent('o1', 2, 'confirmed'), tracker)).toBe('applied')
    expect(qc.getQueryData<Order>(key)).toMatchObject({ status: 'confirmed', version: 2, txHash: '0xtx' })
    expect(qc.getQueryState(cartKey)?.isInvalidated).toBe(true)
  })

  it('descarta duplicata e evento antigo sem regredir o pedido', () => {
    const tracker = createEventTracker()
    applyOrderUpdated(qc, orderEvent('o1', 3, 'confirmed'), tracker)
    expect(applyOrderUpdated(qc, orderEvent('o1', 3, 'confirmed'), tracker)).toBe('duplicate')
    expect(applyOrderUpdated(qc, orderEvent('o2', 2, 'declined'), tracker)).toBe('stale')
    expect(qc.getQueryData<Order>(key)?.status).toBe('confirmed')
  })

  it('rejeita payload inválido', () => {
    expect(applyOrderUpdated(qc, { foo: 1 }, createEventTracker())).toBe('invalid')
  })
})
