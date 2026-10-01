import { HttpResponse, http } from 'msw'
import type { z } from 'zod'
import {
  MAX_WALLETS,
  type Wallet,
  addWalletBodySchema,
  avatarBodySchema,
  newsletterBodySchema,
  passwordBodySchema,
  profileBodySchema,
} from '@/api/contracts'
import { getDb, saveDb } from '../db'
import { fnv } from '../orders'
import { hashPassword } from '../password'
import { apiError, apiPath, authenticate, gate, toPublicUser } from './common'

function fieldsFrom(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message
  return fields
}

function walletsOf(userId: string): Wallet[] {
  return (getDb().wallets[userId] ??= [])
}

export const accountHandlers = [
  // Pública: visitantes também assinam. Reaproveita o gate de escrita de conta (cenário account-fail).
  http.post(apiPath('/newsletter'), async ({ request }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const parsed = newsletterBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Informe um e-mail válido.', fieldsFrom(parsed.error))
    const db = getDb()
    const email = parsed.data.email.toLowerCase()
    if (db.newsletter.includes(email)) return apiError(409, 'CONFLICT', 'Este e-mail já está inscrito.', { email: 'Este e-mail já está inscrito.' })
    db.newsletter.push(email)
    saveDb()
    return HttpResponse.json({ subscribed: true }, { status: 201 })
  }),

  http.patch(apiPath('/profile'), async ({ request }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const parsed = profileBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldsFrom(parsed.error))
    const db = getDb()
    const { displayName, username, email } = parsed.data
    const others = db.users.filter((u) => u.id !== auth.user.id)
    const conflicts: Record<string, string> = {}
    if (others.some((u) => u.email.toLowerCase() === email.toLowerCase())) conflicts.email = 'Este e-mail já está cadastrado.'
    if (others.some((u) => u.username.toLowerCase() === username.toLowerCase())) conflicts.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(conflicts).length > 0) return apiError(409, 'CONFLICT', 'Não foi possível salvar o perfil.', conflicts)
    Object.assign(auth.user, { displayName, username, email })
    saveDb()
    return HttpResponse.json({ user: toPublicUser(auth.user) })
  }),

  http.put(apiPath('/profile/avatar'), async ({ request }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const parsed = avatarBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Imagem inválida.', fieldsFrom(parsed.error).dataUrl ? { avatar: fieldsFrom(parsed.error).dataUrl! } : { avatar: 'Imagem inválida.' })
    auth.user.avatarUrl = parsed.data.dataUrl
    saveDb()
    return HttpResponse.json({ user: toPublicUser(auth.user) })
  }),

  http.delete(apiPath('/profile/avatar'), async ({ request }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    auth.user.avatarUrl = null
    saveDb()
    return HttpResponse.json({ user: toPublicUser(auth.user) })
  }),

  http.post(apiPath('/profile/password'), async ({ request }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const parsed = passwordBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldsFrom(parsed.error))
    if (auth.user.passwordHash !== (await hashPassword(parsed.data.currentPassword))) {
      return apiError(422, 'VALIDATION_ERROR', 'A senha atual está incorreta.', { currentPassword: 'A senha atual está incorreta.' })
    }
    auth.user.passwordHash = await hashPassword(parsed.data.newPassword)
    // Encerra as outras sessões do usuário; a atual continua.
    const db = getDb()
    for (const [token, s] of Object.entries(db.sessions)) {
      if (s.userId === auth.user.id && token !== auth.token) delete db.sessions[token]
    }
    saveDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(apiPath('/wallets'), async ({ request }) => {
    const blocked = await gate('account-read')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    return HttpResponse.json({ items: walletsOf(auth.user.id) })
  }),

  http.post(apiPath('/wallets'), async ({ request }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const parsed = addWalletBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldsFrom(parsed.error))
    const list = walletsOf(auth.user.id)
    if (list.length >= MAX_WALLETS) {
      return apiError(409, 'CONFLICT', `Você pode ter até ${MAX_WALLETS} carteiras.`, { reason: 'LIMIT' })
    }
    if (list.some((w) => w.label.toLowerCase() === parsed.data.label.toLowerCase())) {
      return apiError(409, 'CONFLICT', 'Já existe uma carteira com este nome.', { label: 'Já existe uma carteira com este nome.' })
    }
    const db = getDb()
    db.walletSeq += 1
    const wallet: Wallet = {
      id: `w_${db.walletSeq}`,
      network: parsed.data.network,
      label: parsed.data.label,
      address: `0x${fnv(`${auth.user.id}:${parsed.data.network}:${db.walletSeq}`, 40)}`,
      // A primeira carteira do usuário é sempre a principal.
      isPrimary: list.length === 0,
      createdAt: new Date().toISOString(),
    }
    list.push(wallet)
    saveDb()
    return HttpResponse.json({ items: list }, { status: 201 })
  }),

  // Troca a principal de forma atômica: nunca há zero nem duas principais.
  http.put(apiPath('/wallets/:walletId/primary'), async ({ request, params }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const list = walletsOf(auth.user.id)
    if (!list.some((w) => w.id === params.walletId)) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    for (const w of list) w.isPrimary = w.id === params.walletId
    saveDb()
    return HttpResponse.json({ items: list })
  }),

  http.delete(apiPath('/wallets/:walletId'), async ({ request, params }) => {
    const blocked = await gate('account-write')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    const db = getDb()
    const list = walletsOf(auth.user.id)
    const target = list.find((w) => w.id === params.walletId)
    if (!target) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (target.isPrimary && list.length > 1) {
      return apiError(409, 'CONFLICT', 'Defina outra carteira como principal antes de remover esta.', { reason: 'PRIMARY' })
    }
    db.wallets[auth.user.id] = list.filter((w) => w.id !== target.id)
    saveDb()
    return HttpResponse.json({ items: db.wallets[auth.user.id] })
  }),
]
