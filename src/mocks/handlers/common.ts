import { HttpResponse, delay } from 'msw'
import type { ApiErrorCode } from '@/api/contracts'
import { type UserRecord } from '../fixtures'
import { getDb } from '../db'
import { activeScenario, nextLatency } from '../scenarios'

/** Prefixo curinga: casa com qualquer origem, em dev, preview, deploy e testes em Node. */
export const apiPath = (path: string) => `*/api${path}`

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>,
) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status })
}

type GateKind = 'nfts' | 'auth' | 'favorites-read' | 'favorites-write' | 'cart-read' | 'cart-write' | 'quote' | 'order-read' | 'order-write' | 'wallet' | 'account-read' | 'account-write'

/** Aplica latência e falhas do cenário ativo. Retorna uma resposta se a requisição deve falhar. */
export async function gate(kind: GateKind): Promise<Response | null> {
  const scenario = activeScenario()
  if (scenario.offline) return HttpResponse.error()
  if (scenario.hang) await delay('infinite')
  await delay(nextLatency(scenario))
  if (kind === 'nfts' && scenario.nftsStatus) {
    return apiError(scenario.nftsStatus, 'TRANSIENT', 'Serviço indisponível no momento.')
  }
  if (kind === 'favorites-write' && scenario.favoritesWriteFails) {
    return apiError(503, 'TRANSIENT', 'Não foi possível salvar agora. Tente novamente.')
  }
  if (kind === 'cart-write' && scenario.cartWriteFails) {
    return apiError(503, 'TRANSIENT', 'Não foi possível atualizar o carrinho agora. Tente novamente.')
  }
  if (kind === 'quote' && scenario.quoteStatus) {
    return apiError(scenario.quoteStatus, 'TRANSIENT', 'Não foi possível calcular os valores agora.')
  }
  if (kind === 'order-write' && scenario.orderCreateFails) {
    return apiError(503, 'TRANSIENT', 'Não foi possível criar o pedido agora. Nada foi cobrado.')
  }
  if (kind === 'account-write' && scenario.accountWriteFails) {
    return apiError(503, 'TRANSIENT', 'Não foi possível salvar agora. Tente novamente.')
  }
  if (kind === 'wallet' && scenario.walletRefuses) {
    return apiError(403, 'FORBIDDEN', 'A carteira recusou a conexão.')
  }
  return null
}

export type Authenticated =
  | { user: UserRecord; token: string; response?: never }
  | { response: Response; user?: never; token?: never }

export function authenticate(request: Request): Authenticated {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  const session = token ? getDb().sessions[token] : undefined
  if (!token || !session) {
    return { response: apiError(401, 'UNAUTHENTICATED', 'Entre para continuar.') }
  }
  if (activeScenario().sessionsExpired || Date.parse(session.expiresAt) < Date.now()) {
    return { response: apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
  }
  const user = getDb().users.find((u) => u.id === session.userId)
  if (!user) return { response: apiError(401, 'UNAUTHENTICATED', 'Entre para continuar.') }
  return { user, token }
}

export function toPublicUser({ passwordHash: _omit, ...user }: UserRecord) {
  return user
}
