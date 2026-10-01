import type { QueryClient } from '@tanstack/react-query'
import { type Nft, type NftListResponse, type Order, nftUpdatedEventSchema, orderUpdatedEventSchema } from '@/api/contracts'
import { nftKeys } from '@/api/nfts'

export type ApplyResult = 'applied' | 'duplicate' | 'stale' | 'invalid'

/** Memória de curta duração para tolerar duplicatas e eventos antigos. */
export function createEventTracker(maxIds = 500) {
  const seen = new Set<string>()
  const versions = new Map<string, number>()
  return {
    /** false se o eventId já foi processado. */
    markSeen(eventId: string) {
      if (seen.has(eventId)) return false
      seen.add(eventId)
      if (seen.size > maxIds) seen.delete(seen.values().next().value as string)
      return true
    },
    lastVersion: (key: string) => versions.get(key) ?? -1,
    setVersion: (key: string, version: number) => versions.set(key, version),
    reset() {
      seen.clear()
      versions.clear()
    },
  }
}
export type EventTracker = ReturnType<typeof createEventTracker>

function knownVersion(qc: QueryClient, tracker: EventTracker, id: string): number {
  const detail = qc.getQueryData<Nft>(nftKeys.detail(id))?.version ?? -1
  const fromLists = qc
    .getQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] })
    .flatMap(([, data]) => data?.items ?? [])
    .filter((n) => n.id === id)
    .map((n) => n.version)
  return Math.max(tracker.lastVersion(`nft:${id}`), detail, ...fromLists)
}

/**
 * Aplica nft.updated ao cache do Query. Idempotente: duplicatas e versões antigas
 * nunca regridem um estado mais recente nem reaplicam efeitos.
 */
export function applyNftUpdated(qc: QueryClient, raw: unknown, tracker: EventTracker): ApplyResult {
  const parsed = nftUpdatedEventSchema.safeParse(raw)
  if (!parsed.success) return 'invalid'
  const event = parsed.data
  if (!tracker.markSeen(event.eventId)) return 'duplicate'

  const id = event.resource.id
  if (event.version <= knownVersion(qc, tracker, id)) return 'stale'
  tracker.setVersion(`nft:${id}`, event.version)

  const patch = (nft: Nft): Nft =>
    nft.version >= event.version
      ? nft
      : {
          ...nft,
          price: event.data.price,
          previousPrice: event.data.previousPrice,
          version: event.version,
          editions: nft.editions.map((edition) => {
            const update = event.data.editions.find((e) => e.id === edition.id)
            return update ? { ...edition, available: update.available } : edition
          }),
        }

  qc.setQueryData<Nft>(nftKeys.detail(id), (old) => (old ? patch(old) : old))
  qc.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) =>
    old ? { ...old, items: old.items.map((n) => (n.id === id ? patch(n) : n)) } : old,
  )
  // Preço pode mudar ordenação e filtros: marca as listas como obsoletas sem refetch imediato.
  qc.invalidateQueries({ queryKey: ['nfts', 'list'], refetchType: 'none' })
  // Cotações abertas (carrinho) dependem de preço e estoque: revalida.
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'quote' })
  return 'applied'
}

const isOrderQuery = (q: { queryKey: readonly unknown[] }, id?: string) =>
  q.queryKey[0] === 'user' && q.queryKey[2] === 'orders' && (id === undefined || q.queryKey[3] === id)

/**
 * Aplica order.updated. Mesmas garantias do nft.updated: duplicata e versão antiga não regridem
 * o pedido. Ao concluir, o carrinho (já ajustado no servidor) e a lista de pedidos são revalidados.
 */
export function applyOrderUpdated(qc: QueryClient, raw: unknown, tracker: EventTracker): ApplyResult {
  const parsed = orderUpdatedEventSchema.safeParse(raw)
  if (!parsed.success) return 'invalid'
  const event = parsed.data
  if (!tracker.markSeen(event.eventId)) return 'duplicate'

  const id = event.resource.id
  const cached = qc
    .getQueriesData<Order>({ predicate: (q) => isOrderQuery(q, id) })
    .map(([, order]) => order?.version ?? -1)
  if (event.version <= Math.max(tracker.lastVersion(`order:${id}`), ...cached)) return 'stale'
  tracker.setVersion(`order:${id}`, event.version)

  const hasCached = cached.length > 0 && cached.some((v) => v >= 0)
  if (hasCached) {
    qc.setQueriesData<Order>({ predicate: (q) => isOrderQuery(q, id) }, (old) =>
      old && old.version < event.version
        ? {
            ...old,
            status: event.data.status,
            declineReason: event.data.declineReason,
            txHash: event.data.txHash,
            version: event.version,
            updatedAt: event.occurredAt,
          }
        : old,
    )
  } else {
    void qc.invalidateQueries({ predicate: (q) => isOrderQuery(q, id) })
  }
  if (event.data.status !== 'pending') {
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'cart' })
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'quote' })
  }
  return 'applied'
}
