/** Hash do mock. Em produção seria bcrypt/argon2 no servidor; aqui basta não trafegar senha em claro no estado. */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`kurio-mock:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
