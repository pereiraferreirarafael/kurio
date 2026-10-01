import { guestCart } from '@/cart/guest-cart'
import { api } from './client'
import { cartSchema } from './contracts'
import { queryClient } from './query-client'

export const cartKey = (userId: string) => ['user', userId, 'cart'] as const

/**
 * Após autenticar, incorpora o carrinho de visitante ao do usuário (soma e respeita estoque).
 * Se a mesclagem falhar, o carrinho de visitante é mantido para a próxima tentativa
 * e o login não é bloqueado.
 */
export async function mergeGuestCart(userId: string) {
  const guest = guestCart.get()
  if (guest.items.length === 0 && !guest.coupon) return
  try {
    const { data } = await api.post('/cart/merge', guest)
    queryClient.setQueryData(cartKey(userId), cartSchema.parse(data))
    guestCart.clear()
  } catch {
    // mantém o carrinho local
  }
}
