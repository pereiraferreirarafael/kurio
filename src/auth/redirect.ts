import { z } from 'zod'

/** Só caminhos internos: bloqueia redirecionamento aberto ("//site.com", "https://..."). */
export const internalPath = z
  .string()
  .refine((s) => s.startsWith('/') && !s.startsWith('//') && !s.includes('\\'))
  .optional()
  .catch(undefined)
