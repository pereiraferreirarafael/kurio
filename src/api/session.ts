import { queryOptions } from '@tanstack/react-query'
import { sessionStore } from '@/auth/session-store'
import { api, toApiError } from './client'
import { mergeGuestCart } from './cart-merge'
import {
  type AuthResponse,
  type LoginBody,
  type Session,
  type SignupBody,
  authResponseSchema,
  sessionSchema,
} from './contracts'
import { clearPrivateCache, queryClient } from './query-client'

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  staleTime: 60_000,
  retry: false,
  queryFn: async ({ signal }): Promise<Session | null> => {
    if (!sessionStore.getToken()) return null
    try {
      const { data } = await api.get('/session', { signal })
      return sessionSchema.parse(data)
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.kind === 'UNAUTHENTICATED' || apiError.kind === 'SESSION_EXPIRED') {
        sessionStore.clear()
        return null
      }
      throw apiError
    }
  },
})

async function startSession({ token, ...session }: AuthResponse) {
  // Troca de usuário: nada do usuário anterior pode sobreviver no cache.
  clearPrivateCache()
  sessionStore.setToken(token)
  queryClient.setQueryData(sessionQuery.queryKey, session)
  await mergeGuestCart(session.user.id)
}

export async function login(body: LoginBody) {
  const { data } = await api.post('/auth/login', body)
  await startSession(authResponseSchema.parse(data))
}

export async function signup(body: SignupBody) {
  const { data } = await api.post('/auth/signup', body)
  await startSession(authResponseSchema.parse(data))
}

export async function logout() {
  // A sessão local termina imediatamente e de forma síncrona: navegar ou fechar a aba durante
  // a chamada de rede não pode deixar o token no navegador. O servidor é avisado em seguida.
  const token = sessionStore.getToken()
  sessionStore.clear()
  sessionStore.clearExpired()
  clearPrivateCache()
  queryClient.setQueryData(sessionQuery.queryKey, null)
  if (!token) return
  try {
    await api.post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    // Falha de rede: o token já foi descartado aqui; expira sozinho no servidor.
  }
}
