import { HttpResponse, http } from 'msw'
import { nftListParamsSchema } from '@/api/contracts'
import { listNfts } from '../catalog'
import { findNft } from '../db'
import { apiPath, apiError, gate } from './common'

export const nftHandlers = [
  http.get(apiPath('/nfts'), async ({ request }) => {
    const blocked = await gate('nfts')
    if (blocked) return blocked
    const raw = Object.fromEntries(new URL(request.url).searchParams)
    return HttpResponse.json(listNfts(nftListParamsSchema.parse(raw)))
  }),

  http.get(apiPath('/nfts/:id'), async ({ params }) => {
    const blocked = await gate('nfts')
    if (blocked) return blocked
    const nft = findNft(String(params.id))
    return nft ? HttpResponse.json(nft) : apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
  }),
]
