import { NFT_UPDATED, type NftUpdatedEvent } from '@/api/contracts'
import { sessionStore } from '@/auth/session-store'
import type { EthString } from '@/lib/money'
import { findNft, nextEventId, resetDb, saveDb } from './db'
import {
  type ScenarioName,
  getScenarioName,
  resetScenarioClock,
  scenarioNames,
  scenarios,
  setScenarioName,
} from './scenarios'
import { clearOrderTimers, emitOrderUpdate, findOrder, settleOrder } from './orders'
import { broadcast, connectedClients, dropConnections } from './socket'

interface NftPatch {
  price?: EthString
  /** Nova disponibilidade por id de edição. */
  availability?: Record<string, number>
}

interface EmitOptions {
  /** Emite o mesmo evento duas vezes (mesmo eventId). */
  duplicate?: boolean
  /** Emite um evento com versão antiga, sem alterar o estado. */
  stale?: boolean
}

function eventFor(id: string, version: number, price: string, previousPrice: string | null): NftUpdatedEvent {
  const nft = findNft(id)!
  return {
    eventId: nextEventId(),
    type: NFT_UPDATED,
    resource: { type: 'nft', id },
    version,
    occurredAt: new Date().toISOString(),
    data: {
      price,
      previousPrice,
      editions: nft.editions.map((e) => ({ id: e.id, available: e.available })),
    },
  }
}

/**
 * Muda o estado do mock E emite o evento correspondente pelo socket simulado:
 * REST e tempo real leem do mesmo banco e permanecem consistentes.
 */
export function emitNftUpdate(id: string, patch: NftPatch, options: EmitOptions = {}): NftUpdatedEvent {
  const nft = findNft(id)
  if (!nft) throw new Error(`NFT inexistente: ${id}`)

  let event: NftUpdatedEvent
  if (options.stale) {
    event = eventFor(id, Math.max(0, nft.version - 1), nft.previousPrice ?? nft.price, null)
  } else {
    if (patch.price !== undefined) {
      nft.previousPrice = nft.price
      nft.price = patch.price
    }
    for (const edition of nft.editions) {
      const next = patch.availability?.[edition.id]
      if (next !== undefined) edition.available = next
    }
    nft.version += 1
    saveDb()
    event = eventFor(id, nft.version, nft.price, nft.previousPrice)
  }

  broadcast(NFT_UPDATED, event)
  if (options.duplicate) broadcast(NFT_UPDATED, event)
  return event
}

export const mockControl = {
  scenarios: scenarioNames.map((name) => ({ name, description: scenarios[name].description })),
  getScenario: getScenarioName,
  setScenario(name: ScenarioName) {
    setScenarioName(name)
  },
  /** Restaura o cenário conhecido: banco, relógio de latência e sessão. */
  reset(options: { reload?: boolean } = {}) {
    clearOrderTimers()
    resetDb()
    resetScenarioClock()
    sessionStore.clear()
    if (options.reload ?? true) location.reload()
  },
  emitNftUpdate,
  /** Decide um pedido pendente (cenário order-stall ou para acelerar testes). */
  settleOrder(id: string, outcome: 'confirm' | 'decline' = 'confirm') {
    return settleOrder(id, outcome)
  },
  /** Reenvia order.updated com o estado atual (duplicata opcional). */
  emitOrderUpdate(id: string, options: { duplicate?: boolean } = {}) {
    const order = findOrder(id)
    if (!order) throw new Error(`Pedido inexistente: ${id}`)
    return emitOrderUpdate(order, options)
  },
  connectedClients,
  /** Derruba as conexões Socket.IO (o cliente reconecta e reconcilia com o REST). */
  dropConnections,
}

declare global {
  interface Window {
    __kurioMock?: typeof mockControl
  }
}
