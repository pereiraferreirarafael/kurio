import { HttpResponse, http } from 'msw'
import { loginBodySchema, signupBodySchema } from '@/api/contracts'
import type { z } from 'zod'
import { SESSION_TTL_MS, getDb, saveDb } from '../db'
import { hashPassword } from '../password'
import { apiPath, apiError, authenticate, gate, toPublicUser } from './common'

function fieldsFrom(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message
  return fields
}

function createSession(userId: string) {
  const db = getDb()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.sessions[token] = { userId, expiresAt }
  saveDb()
  return { token, expiresAt }
}

export const authHandlers = [
  http.post(apiPath('/auth/signup'), async ({ request }) => {
    const blocked = await gate('auth')
    if (blocked) return blocked
    const parsed = signupBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldsFrom(parsed.error))
    }
    const db = getDb()
    const { username, email, password } = parsed.data
    const conflicts: Record<string, string> = {}
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      conflicts.email = 'Este e-mail já está cadastrado.'
    }
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      conflicts.username = 'Este nome de usuário já está em uso.'
    }
    if (Object.keys(conflicts).length > 0) {
      return apiError(409, 'CONFLICT', 'Não foi possível criar a conta.', conflicts)
    }
    const user = {
      id: `u_${db.users.length + 1}`,
      username,
      displayName: username,
      email,
      avatarUrl: null,
      passwordHash: await hashPassword(password),
    }
    db.users.push(user)
    const session = createSession(user.id)
    return HttpResponse.json({ ...session, user: toPublicUser(user) }, { status: 201 })
  }),

  http.post(apiPath('/auth/login'), async ({ request }) => {
    const blocked = await gate('auth')
    if (blocked) return blocked
    const parsed = loginBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return apiError(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldsFrom(parsed.error))
    }
    const { email, password } = parsed.data
    const user = getDb().users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!user || user.passwordHash !== (await hashPassword(password))) {
      return apiError(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.')
    }
    const session = createSession(user.id)
    return HttpResponse.json({ ...session, user: toPublicUser(user) })
  }),

  http.get(apiPath('/session'), async ({ request }) => {
    const blocked = await gate('auth')
    if (blocked) return blocked
    const auth = authenticate(request)
    if (auth.response) return auth.response
    return HttpResponse.json({
      user: toPublicUser(auth.user),
      expiresAt: getDb().sessions[auth.token]!.expiresAt,
    })
  }),

  http.post(apiPath('/auth/logout'), async ({ request }) => {
    const blocked = await gate('auth')
    if (blocked) return blocked
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      delete getDb().sessions[token]
      saveDb()
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
