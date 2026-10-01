import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { sessionQuery } from '@/api/session'
import { sessionStore } from '@/auth/session-store'

/** Checkout, perfil, carteiras e pedidos exigem sessão. O retorno ao fluxo vai em ?redirect. */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery)
    if (!session) throw redirect({
        to: '/login',
        // Se o servidor encerrou a sessão, a tela de login avisa (mesmo quando o guard chega antes do aviso global).
        search: { redirect: location.href, ...(sessionStore.wasExpired() ? { reason: 'expired' as const } : {}) },
      })
  },
  component: () => <Outlet />,
})
