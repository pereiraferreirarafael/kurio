import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { Nft, NftListParams } from '@/api/contracts'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { nftListQuery } from '@/api/nfts'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from './nft-card'

interface RelatedCarouselProps {
  title: string
  params: NftListParams
  /** IDs que não devem aparecer (o NFT atual). */
  exclude: string[]
}

/**
 * Carrossel horizontal com rolagem por *scroll-snap*: funciona com toque, trackpad e teclado (os
 * cartões são links focáveis) e ganha botões anterior/próximo. Sem biblioteca: a rolagem nativa
 * já resolve foco, inércia e leitores de tela.
 */
/** Altura reservada (título + cartões) para o espaço não pular quando o carrossel for montado. */
const RESERVED = 'min-h-[430px] sm:min-h-[468px]'

/**
 * Fica abaixo da dobra: só busca dados e monta os cartões quando se aproxima da tela, para não
 * competir com o conteúdo principal (LCP/TBT).
 */
export function RelatedCarousel(props: RelatedCarouselProps) {
  const holder = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = holder.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true)
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near])

  return (
    <div ref={holder} data-related-carousel className={RESERVED}>
      {near ? <RelatedCarouselContent {...props} /> : null}
    </div>
  )
}

function RelatedCarouselContent({ title, params, exclude }: RelatedCarouselProps) {
  const router = useRouter()
  const headingId = useId()
  const track = useRef<HTMLUListElement>(null)
  const { data, isPending, isError, refetch } = useQuery(nftListQuery(params))
  const favorites = useFavorites()
  const toggle = useToggleFavorite(favorites.userId ?? 'anon')

  const items = (data?.items ?? []).filter((n) => !exclude.includes(n.id)).slice(0, 8)

  function onToggleFavorite(nft: Nft, favorite: boolean) {
    if (!favorites.userId) {
      void router.navigate({
        to: '/login',
        search: { redirect: router.state.location.href },
      })
      return
    }
    toggle.mutate({ nftId: nft.id, favorite })
  }

  function scrollBy(direction: 1 | -1) {
    const el = track.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: direction * el.clientWidth * 0.9,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }

  if (!isPending && !isError && items.length === 0) return null

  return (
    <section aria-labelledby={headingId} className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-heading font-bold">
          {title}
        </h2>
        {items.length > 1 ? (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label={`${title}: anteriores`} onClick={() => scrollBy(-1)}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" aria-label={`${title}: próximos`} onClick={() => scrollBy(1)}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>

      {isError ? (
        <p role="alert" className="flex items-center gap-3 text-body text-muted-foreground">
          Não foi possível carregar esta seleção.
          <Button variant="link" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : (
        <ul
          ref={track}
          aria-busy={isPending}
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [&>li]:w-[200px] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[258px]"
        >
          {isPending
            ? Array.from({ length: 4 }, (_, i) => <NftCardSkeleton key={i} />)
            : items.map((nft) => (
                <NftCard key={nft.id} nft={nft} favorite={favorites.ids.includes(nft.id)} onToggleFavorite={onToggleFavorite} />
              ))}
        </ul>
      )}
    </section>
  )
}
