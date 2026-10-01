import { ORDER_UPDATED, type OrderUpdatedEvent } from '@/api/contracts'
import { emitNftUpdate } from './control'
import { type OrderRecord, getDb, nextEventId, saveDb } from './db'
import { emitToUser } from './socket'

export const DEFAULT_SETTLE_MS = 1500
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Hash determinístico (não criptográfico) para ids e hashes de transação simulados. */
export function fnv(input: string, length = 8): string {
  let h = 0x811c9dc5
  let out = ''
  for (let round = 0; out.length < length; round++) {
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i) + round
      h = Math.imul(h, 0x01000193)
    }
    out += (h >>> 0).toString(16).padStart(8, '0')
  }
  return out.slice(0, length)
}

export function findOrder(id: string): OrderRecord | undefined {
  return getDb().orders.find((o) => o.id === id)
}

function orderEvent(order: OrderRecord): OrderUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: ORDER_UPDATED,
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: { status: order.status, declineReason: order.declineReason, txHash: order.txHash },
  }
}

/** Reenvia o estado atual do pedido ao dono (útil para reproduzir duplicatas). */
export function emitOrderUpdate(order: OrderRecord, options: { duplicate?: boolean } = {}) {
  const event = orderEvent(order)
  emitToUser(order.userId, ORDER_UPDATED, event)
  if (options.duplicate) emitToUser(order.userId, ORDER_UPDATED, event)
  return event
}

/**
 * Decide o desfecho de um pedido pendente. Idempotente: pedido já decidido não muda.
 * Na confirmação, revalida o estoque, baixa a disponibilidade (com nft.updated),
 * remove do carrinho do dono SOMENTE o que foi comprado e emite order.updated.
 */
export function settleOrder(id: string, forced?: 'confirm' | 'decline'): OrderRecord | undefined {
  const order = findOrder(id)
  if (!order || order.status !== 'pending') return order
  clearTimeout(timers.get(id))
  timers.delete(id)

  const db = getDb()
  let outcome = forced ?? (order.outcome === 'stall' ? 'confirm' : order.outcome)
  let reason: string | null = null

  if (outcome === 'decline') {
    reason = 'Pagamento recusado pela carteira.'
  } else {
    const short = order.quote.lines.find((line) => {
      const edition = db.nfts.find((n) => n.id === line.nftId)?.editions.find((e) => e.id === line.editionId)
      return !edition || edition.available < line.quantity
    })
    if (short) {
      outcome = 'decline'
      reason = `${short.name} (${short.editionLabel}) deixou de estar disponível durante a confirmação.`
    }
  }

  if (outcome === 'confirm') {
    for (const line of order.quote.lines) {
      const nft = db.nfts.find((n) => n.id === line.nftId)!
      const edition = nft.editions.find((e) => e.id === line.editionId)!
      emitNftUpdate(nft.id, { availability: { [edition.id]: edition.available - line.quantity } })
    }
    const cart = db.carts[order.userId]
    if (cart) {
      for (const line of order.quote.lines) {
        const item = cart.items.find((i) => i.editionId === line.editionId)
        if (!item) continue
        item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      if (cart.items.length === 0) cart.coupon = null
    }
    order.status = 'confirmed'
    order.txHash = `0x${fnv(order.id + order.walletAddress, 64)}`
  } else {
    order.status = 'declined'
    order.declineReason = reason
  }
  order.version += 1
  order.updatedAt = new Date().toISOString()
  saveDb()
  emitOrderUpdate(order)
  return order
}

/** Agenda a decisão do pedido. Em recarga de página, `settleIfDue` cobre timers perdidos. */
export function scheduleSettle(order: OrderRecord) {
  if (order.outcome === 'stall') return
  const wait = Math.max(0, order.settleAt - Date.now())
  timers.set(order.id, setTimeout(() => settleOrder(order.id), wait))
}

export function settleIfDue(order: OrderRecord) {
  if (order.status === 'pending' && order.outcome !== 'stall' && Date.now() >= order.settleAt) {
    return settleOrder(order.id) ?? order
  }
  return order
}

export function clearOrderTimers() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}
