import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { internalPath } from '@/auth/redirect'
import { toApiError } from '@/api/client'
import { loginBodySchema } from '@/api/contracts'
import { login } from '@/api/session'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: internalPath, reason: z.literal('expired').optional().catch(undefined) }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect, reason } = Route.useSearch()
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => router.history.push(redirect ?? '/'),
    onError: (e) => {
      const err = toApiError(e)
      setErrors(Object.keys(err.fields).length > 0 ? err.fields : { form: err.message })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return // evita envio duplicado
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const parsed = loginBodySchema.safeParse(data)
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message
      setErrors(fields)
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  return (
    <section className="mx-auto flex max-w-[500px] flex-col gap-6 px-6 py-16">
      <h1 className="text-heading font-bold">Entrar</h1>
      <p className="text-muted-foreground">Entre para gerenciar sua carteira, coleção e perfil de criador.</p>

      {reason === 'expired' ? (
        <p role="status" className="border border-border-strong bg-card px-4 py-3 text-body">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      ) : null}
      {errors.form ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-body text-destructive">
          {errors.form}
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField label="E-mail" name="email" type="email" autoComplete="email" placeholder="contato@email.com" error={errors.email} />
        <TextField label="Senha" name="password" type="password" autoComplete="current-password" error={errors.password} />
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="text-body text-muted-foreground">
        Novo na Kurio?{' '}
        <Link to="/signup" className="text-accent underline">
          Crie uma conta
        </Link>
      </p>
    </section>
  )
}
