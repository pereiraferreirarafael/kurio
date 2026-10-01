import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, toApiError } from './client'
import {
  type CreateOrderBody,
  IDEMPOTENCY_HEADER,
  type Network,
  orderListSchema,
  orderSchema,
  walletConnectionSchema,
} from './contracts'
import { sessionQuery } from './session'

export const orderKey = (userId: string, orderId: string) => ['user', userId, 'orders', orderId] as const
export const ordersKey = (userId: string) => ['user', userId, 'orders'] as const

export function orderQuery(userId: string, orderId: string) {
  return queryOptions({
    queryKey: orderKey(userId, orderId),
    queryFn: async ({ signal }) => orderSchema.parse((await api.get(`/orders/${encodeURIComponent(orderId)}`, { signal })).data),
    // Rede de segurança: o desfecho normal chega por order.updated (Socket.IO).
    // Se o evento se perder (aba em segundo plano, reconexão), o REST reconcilia.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
  })
}

export function useOrder(orderId: string) {
  const { data: session } = useQuery(sessionQuery)
  const userId = session?.user.id ?? 'anon'
  return useQuery({ ...orderQuery(userId, orderId), enabled: Boolean(session) })
}

export function useOrders() {
  const { data: session } = useQuery(sessionQuery)
  const userId = session?.user.id ?? 'anon'
  return useQuery({
    queryKey: ordersKey(userId),
    enabled: Boolean(session),
    queryFn: async ({ signal }) => orderListSchema.parse((await api.get('/orders', { signal })).data).items,
  })
}

// ---- Chave de idempotência --------------------------------------------------
// A chave vive enquanto a tentativa está "em aberto": após timeout ou queda de rede,
// repetir o envio reutiliza a chave e o servidor devolve o mesmo pedido (sem cobrança dupla).
// Erros definitivos (409/422) ou sucesso liberam a chave.

const KEYS = 'kurio.checkout.keys'

function contentId(body: CreateOrderBody) {
  const items = [...body.items].sort((a, b) => a.editionId.localeCompare(b.editionId))
  return JSON.stringify([items, body.coupon ?? null, body.network, body.walletAddress, body.quoteFingerprint])
}

function readKeys(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEYS) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function writeKeys(keys: Record<string, string>) {
  try {
    sessionStorage.setItem(KEYS, JSON.stringify(keys))
  } catch {
    /* sem sessionStorage: a chave vale só enquanto a aba estiver aberta (memória) */
  }
}
const memory: Record<string, string> = {}

export function idempotencyKeyFor(body: CreateOrderBody): string {
  const id = contentId(body)
  const keys = { ...memory, ...readKeys() }
  const key = keys[id] ?? `idem_${crypto.randomUUID()}`
  memory[id] = key
  writeKeys({ ...readKeys(), [id]: key })
  return key
}

export function releaseIdempotencyKey(body: CreateOrderBody) {
  const id = contentId(body)
  delete memory[id]
  const keys = readKeys()
  delete keys[id]
  writeKeys(keys)
}

export function useCreateOrder() {
  const qc = useQueryClient()
  const { data: session } = useQuery(sessionQuery)
  return useMutation({
    // Sem retry automático: a repetição é uma decisão explícita do usuário, com a mesma chave.
    mutationFn: async (body: CreateOrderBody) => {
      const key = idempotencyKeyFor(body)
      try {
        const { data } = await api.post('/orders', body, { headers: { [IDEMPOTENCY_HEADER]: key } })
        const order = orderSchema.parse(data)
        releaseIdempotencyKey(body)
        return order
      } catch (error) {
        const apiError = toApiError(error)
        if (!apiError.isTransient) releaseIdempotencyKey(body)
        throw apiError
      }
    },
    onSuccess: (order) => {
      if (session) {
        qc.setQueryData(orderKey(session.user.id, order.id), order)
        void qc.invalidateQueries({ queryKey: ordersKey(session.user.id), exact: true })
      }
    },
  })
}

// ---- Carteira simulada ---------------------------------------------------------

export function useConnectWallet() {
  return useMutation({
    mutationFn: async (network: Network) =>
      walletConnectionSchema.parse((await api.post('/wallet/connect', { network })).data),
  })
}
