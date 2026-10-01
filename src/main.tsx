import '@/index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sessionQuery } from '@/api/session'
import { clearPrivateCache, queryClient } from '@/api/query-client'
import { sessionStore } from '@/auth/session-store'
import { env } from '@/lib/env'
import { holdNetworkUntil } from '@/lib/ready'
import { RealtimeBridge } from '@/realtime/realtime-bridge'
import { router } from './router'

async function bootstrap() {
  // A UI renderiza já; a rede só libera quando o MSW estiver ativo (ver lib/ready.ts).
  if (env.enableMocks) {
    holdNetworkUntil(import('@/mocks').then(({ enableMocking }) => enableMocking()))
  }

  // Sessão expirada durante a navegação: limpa dados privados e volta ao login preservando o contexto.
  sessionStore.onExpired(() => {
    clearPrivateCache()
    queryClient.setQueryData(sessionQuery.queryKey, null)
    const { pathname, href } = router.state.location
    if (pathname !== '/login') {
      void router.navigate({ to: '/login', search: { redirect: href, reason: 'expired' } })
    }
  })

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RealtimeBridge />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
