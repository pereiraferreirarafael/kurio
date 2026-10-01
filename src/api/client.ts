import axios, { AxiosError, type AxiosInstance } from 'axios'
import { sessionStore } from '@/auth/session-store'
import { env } from '@/lib/env'
import { whenNetworkReady } from '@/lib/ready'
import { type ApiErrorCode, apiErrorBodySchema } from './contracts'

export type ApiErrorKind = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN'

/** Erro único exposto à UI. Nenhum AxiosError vaza para componentes. */
export class ApiError extends Error {
  readonly status: number | null
  readonly kind: ApiErrorKind
  readonly fields: Record<string, string>

  constructor(
    kind: ApiErrorKind,
    message: string,
    status: number | null = null,
    fields: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.fields = fields
  }

  /** Falhas que podem se resolver sozinhas. Só estas são candidatas a retry. */
  get isTransient() {
    return (
      this.kind === 'NETWORK_ERROR' ||
      this.kind === 'TIMEOUT' ||
      this.kind === 'TRANSIENT' ||
      (this.status !== null && this.status >= 500)
    )
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError('UNKNOWN', 'Requisição cancelada')
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError('TIMEOUT', 'A requisição demorou demais. Tente novamente.')
    }
    if (!error.response) {
      return new ApiError('NETWORK_ERROR', 'Sem conexão com o servidor. Verifique sua rede.')
    }
    const parsed = apiErrorBodySchema.safeParse(error.response.data)
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error
      return new ApiError(code, message, error.response.status, fields)
    }
    return new ApiError(
      error.response.status >= 500 ? 'TRANSIENT' : 'UNKNOWN',
      'Algo deu errado. Tente novamente.',
      error.response.status,
    )
  }
  return new ApiError('UNKNOWN', 'Algo deu errado. Tente novamente.')
}

export function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 8000 })

  client.interceptors.request.use(async (config) => {
    await whenNetworkReady()
    const token = sessionStore.getToken()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const apiError = toApiError(error)
      if (apiError.kind === 'SESSION_EXPIRED') sessionStore.markExpired()
      return Promise.reject(apiError)
    },
  )

  return client
}

export const api = createApiClient(env.apiBaseUrl)
