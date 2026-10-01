import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { favoritesResponseSchema } from './contracts'
import { sessionQuery } from './session'

export const favoritesKey = (userId: string) => ['user', userId, 'favorites'] as const

export function favoritesQuery(userId: string) {
  return queryOptions({
    queryKey: favoritesKey(userId),
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/favorites', { signal })
      return favoritesResponseSchema.parse(data).nftIds
    },
  })
}

/** Favoritos do usuário autenticado. Sem sessão, lista vazia e query desligada. */
export function useFavorites() {
  const { data: session } = useQuery(sessionQuery)
  const userId = session?.user.id
  const query = useQuery({ ...favoritesQuery(userId ?? 'anon'), enabled: Boolean(userId) })
  return { userId, ids: query.data ?? [], isAuthenticated: Boolean(userId) }
}

/** Atualização otimista com rollback se a API falhar. */
export function useToggleFavorite(userId: string) {
  const qc = useQueryClient()
  const key = favoritesKey(userId)
  return useMutation({
    mutationFn: async ({ nftId, favorite }: { nftId: string; favorite: boolean }) => {
      if (favorite) await api.put(`/favorites/${encodeURIComponent(nftId)}`)
      else await api.delete(`/favorites/${encodeURIComponent(nftId)}`)
    },
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<string[]>(key) ?? []
      qc.setQueryData<string[]>(
        key,
        favorite ? [...new Set([...previous, nftId])] : previous.filter((id) => id !== nftId),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context) qc.setQueryData(key, context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
