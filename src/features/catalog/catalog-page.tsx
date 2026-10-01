import { useQuery } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { toApiError } from '@/api/client'
import { type Nft, type NftListParams, NFT_PAGE_SIZE } from '@/api/contracts'
import { useFavorites, useToggleFavorite } from '@/api/favorites'
import { nftListQuery } from '@/api/nfts'
import { Button, buttonVariants } from '@/components/ui/button'
import { Filters } from './filters'
import { NftCard, NftCardSkeleton } from './nft-card'
import { Pagination } from './pagination'
import { Toolbar } from './toolbar'

export function CatalogPage({ search }: { search: NftListParams }) {
  const router = useRouter()
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = useQuery(nftListQuery(search))
  const favorites = useFavorites()
  const toggle = useToggleFavorite(favorites.userId ?? 'anon')

  function onToggleFavorite(nft: Nft, favorite: boolean) {
    if (!favorites.userId) {
      // Favoritos exigem autenticação: volta para cá depois do login.
      void router.navigate({ to: '/login', search: { redirect: router.state.location.href } })
      return
    }
    toggle.mutate({ nftId: nft.id, favorite })
  }

  const hasFilters = Boolean(search.q || search.collection || search.network || search.minPrice || search.maxPrice || search.tab !== 'all')

  return (
    <div id="mercado" className="grid scroll-mt-4 gap-12 lg:grid-cols-[310px_1fr]">
      <Filters search={search} facets={data?.facets} />

      <section aria-labelledby="titulo-catalogo" className="flex flex-col gap-6">
        <h2 id="titulo-catalogo" className="sr-only">
          Catálogo de NFTs
        </h2>
        <Toolbar search={search} />

        <p aria-live="polite" className="sr-only">
          {data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : 'Carregando NFTs…'}
        </p>

        {toggle.isError ? (
          <p role="alert" className="border border-destructive px-4 py-3 text-body text-destructive">
            Não foi possível atualizar seus favoritos. A alteração foi desfeita.
          </p>
        ) : null}

        {isError && !data ? (
          <div role="alert" className="flex flex-col items-start gap-4 border border-border-strong bg-card p-6">
            <p className="text-body">{toApiError(error).message}</p>
            <Button onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        ) : isPending ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3" aria-busy="true">
            {Array.from({ length: NFT_PAGE_SIZE }, (_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </ul>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 border border-border-strong bg-card p-6">
            <p className="text-body">
              {data.total > 0 ? 'Esta página não tem resultados.' : 'Nenhum NFT encontrado para estes filtros.'}
            </p>
            <Link
              to="/"
              search={data.total > 0 ? (prev) => ({ ...prev, page: 1 }) : {}}
              className={buttonVariants({ variant: 'outline' })}
            >
              {data.total > 0 ? 'Voltar à primeira página' : hasFilters ? 'Limpar filtros' : 'Atualizar'}
            </Link>
          </div>
        ) : (
          <>
            {isError ? (
              <p role="status" className="text-caption text-destructive">
                Não foi possível atualizar. Mostrando os últimos dados carregados.
              </p>
            ) : null}
            <ul
              aria-busy={isFetching}
              className={`grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity md:grid-cols-3 ${isPlaceholderData ? 'opacity-60' : ''}`}
            >
              {data.items.map((nft, index) => (
                <NftCard
                  key={nft.id}
                  nft={nft}
                  priority={index < 3}
                  favorite={favorites.ids.includes(nft.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} />
          </>
        )}
      </section>
    </div>
  )
}
