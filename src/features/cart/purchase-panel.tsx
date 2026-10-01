import { useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '@/api/cart'
import { toApiError } from '@/api/client'
import type { Nft } from '@/api/contracts'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QuantityStepper } from './quantity-stepper'

/** Seleção de edição e quantidade, com limite vindo do estoque em tempo real. */
export function PurchasePanel({ nft }: { nft: Nft }) {
  const navigate = useNavigate()
  const { quantityOf, setQuantity } = useCart()
  const { userId, ids } = useFavorites()
  const toggle = useToggleFavorite(userId ?? 'anon')
  const firstAvailable = nft.editions.find((e) => e.available > 0)
  const [editionId, setEditionId] = useState(firstAvailable?.id ?? nft.editions[0]!.id)
  const [quantity, setQuantityState] = useState(1)
  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const inCart = quantityOf(edition.id)
  const remaining = Math.max(0, edition.available - inCart)
  // O estoque pode cair por evento em tempo real: a quantidade acompanha o limite.
  const safeQuantity = Math.min(quantity, Math.max(remaining, 1))
  const favorite = ids.includes(nft.id)
  const [message, setMessage] = useState<string | null>(null)

  async function add(goToCart: boolean) {
    setMessage(null)
    try {
      await setQuantity.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity: inCart + safeQuantity })
      if (goToCart) await navigate({ to: '/cart' })
      else setMessage(`${safeQuantity} × ${edition.label} adicionado ao carrinho.`)
    } catch (e) {
      setMessage(toApiError(e).message)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">Edição</legend>
        <div className="flex flex-wrap gap-3">
          {nft.editions.map((e) => {
            const soldOut = e.available === 0
            return (
              <label
                key={e.id}
                className={cn(
                  'cursor-pointer border px-3 py-1 text-body has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  e.id === editionId ? 'border-accent text-accent' : 'border-border-strong',
                  soldOut && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="radio"
                  name="edition"
                  className="sr-only"
                  checked={e.id === editionId}
                  disabled={soldOut}
                  onChange={() => {
                    setEditionId(e.id)
                    setQuantityState(1)
                  }}
                />
                {e.label} · {soldOut ? 'esgotada' : `${e.available} ${e.available === 1 ? "disponível" : "disponíveis"}`}
              </label>
            )
          })}
        </div>
      </fieldset>

      {remaining > 0 ? (
        <QuantityStepper label="quantidade" value={safeQuantity} max={remaining} onChange={setQuantityState} />
      ) : (
        <p className="text-body text-destructive">
          {edition.available === 0 ? 'Esta edição está esgotada.' : 'Você já tem todo o estoque desta edição no carrinho.'}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button size="lg" disabled={remaining === 0 || setQuantity.isPending} onClick={() => void add(true)}>
          Comprar
        </Button>
        <Button size="lg" variant="outline" disabled={remaining === 0 || setQuantity.isPending} onClick={() => void add(false)}>
          Adicionar ao carrinho
        </Button>
        <Button
          size="lg"
          variant="outline"
          aria-pressed={favorite}
          onClick={() =>
            userId
              ? toggle.mutate({ nftId: nft.id, favorite: !favorite })
              : void navigate({ to: '/login', search: { redirect: `/nft/${nft.id}` } })
          }
        >
          <Heart className={cn('size-5', favorite && 'fill-accent text-accent')} aria-hidden="true" />
          Favoritar
        </Button>
      </div>
      <p role="status" className="min-h-5 text-body text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
