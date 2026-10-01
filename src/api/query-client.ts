import { QueryClient } from '@tanstack/react-query'
import { toApiError } from './client'

/**
 * Política de cache, retry e sincronização (ver ARCHITECTURE.md):
 * - staleTime 30s para dados públicos. Dados do usuário usam staleTime próprio.
 * - Retry apenas para falhas transitórias (rede, timeout, 5xx), no máximo 2x, com backoff.
 *   Erros 4xx nunca são repetidos. Mutations nunca têm retry automático (idempotência).
 * - Refetch ao focar a janela e ao reconectar ficam ligados (padrão do Query).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => toApiError(error).isTransient && failureCount < 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
    mutations: { retry: false },
  },
})

/**
 * Chaves de dados privados começam com 'user' (e incluem o id do usuário) e são removidas em logout e
 * troca de usuário. A query ['session'] NÃO é removida: observers montados (cabeçalho) ficariam presos
 * ao objeto removido e não veriam o novo valor. Quem inicia/encerra sessão escreve ['session'] explicitamente.
 */
export function clearPrivateCache() {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'user' })
}
