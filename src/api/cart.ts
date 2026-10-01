import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { guestCart } from '@/cart/guest-cart'
import { api } from './client'
import { cartKey } from './cart-merge'
import { type CartState, cartSchema, couponSchema, quoteSchema } from './contracts'
import { sessionQuery } from './session'

export { cartKey }
const EMPTY: CartState = { items: [], coupon: null }
const WRITE = ['cart-write'] as const

export function quoteKey(scope: string, cart: CartState) {
  // Chave canônica: a ordem dos itens não gera cotação duplicada.
  const items = [...cart.items].sort((a, b) => a.editionId.localeCompare(b.editionId))
  return ['user', scope, 'quote', items, cart.coupon] as const
}

/**
 * Carrinho unificado. Visitante: localStorage. Autenticado: API, com atualização otimista,
 * rollback em falha e escritas serializadas (a última resposta nunca é sobrescrita por uma antiga).
 */
export function useCart() {
  const qc = useQueryClient()
  const { data: session } = useQuery(sessionQuery)
  const userId = session?.user.id
  const guest = useSyncExternalStore(guestCart.subscribe, guestCart.get, guestCart.get)

  const server = useQuery({
    queryKey: cartKey(userId ?? 'anon'),
    queryFn: async ({ signal }) => cartSchema.parse((await api.get('/cart', { signal })).data),
    enabled: Boolean(userId),
  })
  const cart = userId ? (server.data ?? EMPTY) : guest

  /** Aplica a escrita otimista no cache do usuário. */
  function optimistic(update: (c: CartState) => CartState) {
    const key = cartKey(userId!)
    const previous = qc.getQueryData<CartState>(key) ?? EMPTY
    qc.setQueryData<CartState>(key, update(previous))
    return previous
  }
  const settle = () => {
    // Só revalida quando a última escrita pendente termina.
    if (userId && qc.isMutating({ mutationKey: WRITE }) <= 1) void qc.invalidateQueries({ queryKey: cartKey(userId) })
  }

  const setQuantityMutation = useMutation({
    mutationKey: WRITE,
    scope: { id: 'cart' },
    mutationFn: async (v: { nftId: string; editionId: string; quantity: number }) => {
      if (!userId) {
        guestCart.setQuantity(v.nftId, v.editionId, v.quantity)
        return
      }
      if (v.quantity <= 0) await api.delete(`/cart/items/${encodeURIComponent(v.editionId)}`)
      else await api.put(`/cart/items/${encodeURIComponent(v.editionId)}`, { nftId: v.nftId, quantity: v.quantity })
    },
    onMutate: async (v) => {
      if (!userId) return { previous: null }
      await qc.cancelQueries({ queryKey: cartKey(userId) })
      const previous = optimistic((c) => ({
        ...c,
        items:
          v.quantity > 0
            ? [...c.items.filter((i) => i.editionId !== v.editionId), { nftId: v.nftId, editionId: v.editionId, quantity: v.quantity }]
            : c.items.filter((i) => i.editionId !== v.editionId),
      }))
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (userId && ctx?.previous) qc.setQueryData(cartKey(userId), ctx.previous)
    },
    onSettled: settle,
  })

  const couponMutation = useMutation({
    mutationKey: WRITE,
    scope: { id: 'cart' },
    mutationFn: async (code: string | null) => {
      if (!userId) {
        if (code === null) return guestCart.setCoupon(null)
        const { data } = await api.post('/coupons/validate', { code })
        guestCart.setCoupon(couponSchema.parse(data).code)
        return
      }
      const { data } =
        code === null ? await api.delete('/cart/coupon') : await api.put('/cart/coupon', { code })
      qc.setQueryData(cartKey(userId), cartSchema.parse(data))
    },
  })

  return {
    userId,
    cart,
    itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
    isLoading: Boolean(userId) && server.isPending,
    loadError: userId ? server.error : null,
    refetch: () => server.refetch(),
    setQuantity: setQuantityMutation,
    coupon: couponMutation,
    quantityOf: (editionId: string) => cart.items.find((i) => i.editionId === editionId)?.quantity ?? 0,
  }
}

/** Cotação calculada pela API: preços, estoque, cupom e taxa. O cliente nunca soma por conta própria. */
export function useQuote(cart: CartState, scope: string) {
  return useQuery({
    queryKey: quoteKey(scope, cart),
    enabled: cart.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    queryFn: async ({ signal }) => quoteSchema.parse((await api.post('/quote', cart, { signal })).data),
  })
}
