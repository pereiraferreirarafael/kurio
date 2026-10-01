import { HttpResponse, http } from 'msw'
import {
  type CartItem,
  type CartState,
  cartItemBodySchema,
  couponCodeBodySchema,
  quoteRequestSchema,
} from '@/api/contracts'
import { findNft, getDb, saveDb } from '../db'
import { buildQuote, resolveCoupon } from '../pricing'
import { apiError, apiPath, authenticate, gate } from './common'

function cartOf(userId: string): CartState {
  const db = getDb()
  return (db.carts[userId] ??= { items: [], coupon: null })
}

function editionStock(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  return nft?.editions.find((e) => e.id === editionId)
}

function couponError(code: string) {
  const resolved = resolveCoupon(code)
  if (resolved.status === 'applied') return { resolved, response: null }
  const message = resolved.status === 'expired' ? 'Este cupom expirou.' : 'Cupom inválido.'
  return { resolved, response: apiError(422, 'VALIDATION_ERROR', message, { coupon: message }) }
}

export const cartHandlers = [
  http.get(apiPath('/cart'), async ({ request }) => {
    const blocked = await gate('cart-read')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    return HttpResponse.json(cartOf(auth.user.id))
  }),

  // Define a quantidade absoluta (upsert). Excesso de estoque é conflito de disponibilidade.
  http.put(apiPath('/cart/items/:editionId'), async ({ request, params }) => {
    const blocked = await gate('cart-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const parsed = cartItemBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { quantity: 'Informe uma quantidade inteira.' })

    const editionId = String(params.editionId)
    const edition = editionStock(parsed.data.nftId, editionId)
    if (!edition) return apiError(404, 'NOT_FOUND', 'Edição não encontrada.')
    if (parsed.data.quantity > edition.available) {
      const message = edition.available === 0 ? 'Esta edição está esgotada.' : `Apenas ${edition.available} disponível(is) nesta edição.`
      return apiError(409, 'CONFLICT', message, { quantity: message })
    }
    const cart = cartOf(auth.user.id)
    const item: CartItem = { nftId: parsed.data.nftId, editionId, quantity: parsed.data.quantity }
    const index = cart.items.findIndex((i) => i.editionId === editionId)
    if (index >= 0) cart.items[index] = item
    else cart.items.push(item)
    saveDb()
    return HttpResponse.json(cart)
  }),

  http.delete(apiPath('/cart/items/:editionId'), async ({ request, params }) => {
    const blocked = await gate('cart-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const cart = cartOf(auth.user.id)
    cart.items = cart.items.filter((i) => i.editionId !== String(params.editionId))
    saveDb()
    return HttpResponse.json(cart)
  }),

  // Incorpora o carrinho de visitante ao autenticar: soma quantidades e respeita o estoque.
  http.post(apiPath('/cart/merge'), async ({ request }) => {
    const blocked = await gate('cart-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const body = quoteRequestSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return apiError(422, 'VALIDATION_ERROR', 'Carrinho inválido.')
    const cart = cartOf(auth.user.id)
    for (const incoming of body.data.items) {
      const edition = editionStock(incoming.nftId, incoming.editionId)
      if (!edition || edition.available === 0) continue
      const existing = cart.items.find((i) => i.editionId === incoming.editionId)
      const quantity = Math.min((existing?.quantity ?? 0) + incoming.quantity, edition.available)
      if (existing) existing.quantity = quantity
      else cart.items.push({ ...incoming, quantity })
    }
    if (!cart.coupon && body.data.coupon && resolveCoupon(body.data.coupon).status === 'applied') {
      cart.coupon = resolveCoupon(body.data.coupon).status === 'applied' ? body.data.coupon.trim().toUpperCase() : null
    }
    saveDb()
    return HttpResponse.json(cart)
  }),

  http.put(apiPath('/cart/coupon'), async ({ request }) => {
    const blocked = await gate('cart-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const body = couponCodeBodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return apiError(422, 'VALIDATION_ERROR', 'Informe o código.', { coupon: 'Informe o código.' })
    const { resolved, response } = couponError(body.data.code)
    if (response) return response
    const cart = cartOf(auth.user.id)
    cart.coupon = resolved.status === 'applied' ? resolved.coupon.code : null
    saveDb()
    return HttpResponse.json(cart)
  }),

  http.delete(apiPath('/cart/coupon'), async ({ request }) => {
    const blocked = await gate('cart-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const cart = cartOf(auth.user.id)
    cart.coupon = null
    saveDb()
    return HttpResponse.json(cart)
  }),

  // Validação pública de cupom (visitantes também aplicam cupom antes de autenticar).
  http.post(apiPath('/coupons/validate'), async ({ request }) => {
    const blocked = await gate('cart-read')
    if (blocked) return blocked
    const body = couponCodeBodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return apiError(422, 'VALIDATION_ERROR', 'Informe o código.', { coupon: 'Informe o código.' })
    const { resolved, response } = couponError(body.data.code)
    if (response) return response
    return HttpResponse.json(resolved.status === 'applied' ? resolved.coupon : null)
  }),

  http.post(apiPath('/quote'), async ({ request }) => {
    const blocked = await gate('quote')
    if (blocked) return blocked
    const body = quoteRequestSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return apiError(422, 'VALIDATION_ERROR', 'Carrinho inválido.')
    return HttpResponse.json(buildQuote(getDb().nfts, body.data.items, body.data.coupon))
  }),
]
