import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { sessionStore } from '@/auth/session-store'
import { createRealtime } from './socket'

/** Liga o socket ao ciclo de vida da sessão. O cleanup libera listeners ao trocar de usuário. */
export function RealtimeBridge() {
  const qc = useQueryClient()
  const token = useSyncExternalStore(sessionStore.subscribe, sessionStore.getToken, () => null)

  useEffect(() => {
    const realtime = createRealtime(qc)
    // Tempo real não é necessário para o primeiro pintar: conecta quando o navegador estiver ocioso,
    // para não competir por CPU com a renderização inicial.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => void realtime.connect(token), { timeout: 1500 })
    return () => {
      cancel(handle)
      realtime.disconnect()
    }
  }, [qc, token])

  return null
}
