import { env } from '@/lib/env'
import { mockControl } from './control'
import { configureScenarios } from './scenarios'

/** Liga a camada de rede simulada (REST + Socket.IO). Ativada por VITE_ENABLE_MOCKS. */
export async function enableMocking() {
  configureScenarios(env.defaultScenario)
  const { worker } = await import('./browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  window.__kurioMock = mockControl
}
