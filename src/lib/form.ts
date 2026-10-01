import type { z } from 'zod'
import { toApiError } from '@/api/client'

/** Primeiro erro de cada campo de um ZodError. */
export function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message
  return fields
}

/** Erros de campo vindos da API; sem campos, uma mensagem geral em `form`. */
export function apiFields(error: unknown): Record<string, string> {
  const e = toApiError(error)
  const { reason: _reason, ...fields } = e.fields
  return Object.keys(fields).length > 0 ? fields : { form: e.message }
}
