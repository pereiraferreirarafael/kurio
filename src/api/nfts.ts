import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from './client'
import { type NftListParams, nftListResponseSchema, nftSchema } from './contracts'

export const nftKeys = {
  all: ['nfts'] as const,
  list: (params: NftListParams) => ['nfts', 'list', params] as const,
  detail: (id: string) => ['nfts', 'detail', id] as const,
}

export function nftListQuery(params: NftListParams) {
  return queryOptions({
    queryKey: nftKeys.list(params),
    // O signal cancela a requisição anterior quando os filtros mudam (respostas obsoletas).
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/nfts', { params, signal })
      return nftListResponseSchema.parse(data)
    },
    placeholderData: keepPreviousData,
  })
}

export function nftDetailQuery(id: string) {
  return queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await api.get(`/nfts/${encodeURIComponent(id)}`, { signal })
      return nftSchema.parse(data)
    },
  })
}
