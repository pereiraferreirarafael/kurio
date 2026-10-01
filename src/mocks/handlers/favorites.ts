import { HttpResponse, http } from 'msw'
import { findNft, getDb, saveDb } from '../db'
import { apiPath, apiError, authenticate, gate } from './common'

export const favoritesHandlers = [
  http.get(apiPath('/favorites'), async ({ request }) => {
    const blocked = await gate('favorites-read')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    return HttpResponse.json({ nftIds: getDb().favorites[auth.user.id] ?? [] })
  }),

  http.put(apiPath('/favorites/:nftId'), async ({ request, params }) => {
    const blocked = await gate('favorites-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const nftId = String(params.nftId)
    if (!findNft(nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
    const db = getDb()
    db.favorites[auth.user.id] = [...new Set([...(db.favorites[auth.user.id] ?? []), nftId])]
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(apiPath('/favorites/:nftId'), async ({ request, params }) => {
    const blocked = await gate('favorites-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const db = getDb()
    db.favorites[auth.user.id] = (db.favorites[auth.user.id] ?? []).filter((id) => id !== String(params.nftId))
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),
]
