import { Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import type { Nft } from '@/api/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

interface NftCardProps {
  nft: Nft
  favorite: boolean
  onToggleFavorite: (nft: Nft, favorite: boolean) => void
  /** Primeiras linhas do grid: carregam com prioridade (LCP). */
  priority?: boolean
}

export function NftCard({ nft, favorite, onToggleFavorite, priority = false }: NftCardProps) {
  const soldOut = nft.editions.every((e) => e.available === 0)
  return (
    <li className="relative">
      <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="group block">
        <div className="grid aspect-[258/300] place-items-center bg-card">
          <img
            src={nft.image}
            alt={`Arte de ${nft.name}`}
            width={250}
            height={250}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className="aspect-square w-[97%] rounded-[14px] object-cover"
          />
        </div>
        <div className="flex h-14 flex-col justify-center gap-1">
          <span className="truncate text-body font-medium">{nft.name}</span>
          <span className="flex items-center gap-3 text-body">
            <span className="font-bold text-accent">{formatEth(nft.price)}</span>
            {nft.previousPrice ? (
              <s className="text-muted-foreground">
                <span className="sr-only">Preço anterior </span>
                {formatEth(nft.previousPrice)}
              </s>
            ) : null}
            {soldOut ? <span className="text-caption text-destructive">Esgotado</span> : null}
          </span>
        </div>
      </Link>
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={favorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
        onClick={() => onToggleFavorite(nft, !favorite)}
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-background/80 text-foreground hover:bg-background"
      >
        <Heart className={cn('size-4', favorite && 'fill-accent text-accent')} aria-hidden="true" />
      </button>
    </li>
  )
}

/** Mesmas dimensões do card real: evita deslocamento de layout (CLS). */
export function NftCardSkeleton() {
  return (
    <li aria-hidden="true">
      <div className="skeleton aspect-[258/300]" />
      <div className="flex h-14 flex-col justify-center gap-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/3" />
      </div>
    </li>
  )
}
