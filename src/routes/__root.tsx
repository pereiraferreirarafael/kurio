import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import { NotFound } from '@/components/not-found'
import { SiteHeader } from '@/components/site-header'

// O rodapé fica abaixo da dobra: sai do bundle crítico e carrega depois.
const SiteFooter = lazy(() => import('@/components/site-footer').then((m) => ({ default: m.SiteFooter })))

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: () => <NotFound />,
})

function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" className="min-h-[70vh]">
        <Outlet />
      </main>
      <Suspense fallback={<div aria-hidden="true" className="mt-24 h-[700px]" />}>
        <SiteFooter />
      </Suspense>
    </>
  )
}
