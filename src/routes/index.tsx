import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { nftListParamsSchema } from '@/api/contracts'
import { nftListQuery } from '@/api/nfts'
import { CatalogPage } from '@/features/catalog/catalog-page'
import { Hero } from '@/features/home/hero'

// Seções abaixo da dobra: fora do bundle inicial.
const Promos = lazy(() => import('@/features/home/promos').then((m) => ({ default: m.Promos })))
const Blog = lazy(() => import('@/features/home/blog').then((m) => ({ default: m.Blog })))

export const Route = createFileRoute('/')({
  // Busca, filtros, ordenação e paginação vivem na URL: sobrevivem a refresh e ao histórico.
  validateSearch: nftListParamsSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps.search))
  },
  component: Index,
})

function Index() {
  return (
    <>
      <Hero />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-24 px-6 pt-10">
        <CatalogPage search={Route.useSearch()} />
        <Suspense fallback={<div aria-hidden="true" className="min-h-[900px]" />}>
          <Promos />
          <Blog />
        </Suspense>
      </div>
    </>
  )
}
