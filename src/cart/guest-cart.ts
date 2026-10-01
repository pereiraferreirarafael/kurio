import { type CartState, cartSchema } from '@/api/contracts'

const KEY = 'kurio.cart.guest'
const EMPTY: CartState = { items: [], coupon: null }

/**
 * Carrinho de visitante: vive no navegador (localStorage) e é mesclado ao do usuário no login.
 * Sempre validado com o mesmo schema do contrato; conteúdo corrompido vira carrinho vazio.
 */
function read(): CartState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = cartSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY
  } catch {
    return EMPTY
  }
}

let current = read()
const listeners = new Set<() => void>()

function commit(next: CartState) {
  current = next.items.length === 0 && !next.coupon ? EMPTY : next
  try {
    if (current === EMPTY) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Sem armazenamento (modo privado): o carrinho segue em memória.
  }
  for (const l of listeners) l()
}

export const guestCart = {
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
  setQuantity(nftId: string, editionId: string, quantity: number) {
    const others = current.items.filter((i) => i.editionId !== editionId)
    commit({
      ...current,
      items: quantity > 0 ? [...others, { nftId, editionId, quantity }].sort(byEdition) : others,
    })
  },
  setCoupon: (coupon: string | null) => commit({ ...current, coupon }),
  clear: () => commit(EMPTY),
  /** Sincroniza abas: outra aba alterou o carrinho. */
  reload() {
    current = read()
    for (const l of listeners) l()
  },
}

const byEdition = (a: { editionId: string }, b: { editionId: string }) => a.editionId.localeCompare(b.editionId)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) guestCart.reload()
  })
}
