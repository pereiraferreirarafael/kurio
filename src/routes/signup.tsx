import { useMutation } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'
import { toApiError } from '@/api/client'
import { signupBodySchema } from '@/api/contracts'
import { signup } from '@/api/session'
import { internalPath } from '@/auth/redirect'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'

export const Route = createFileRoute('/signup')({
  validateSearch: z.object({ redirect: internalPath }),
  component: SignupPage,
})

function SignupPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: () => router.history.push(redirect ?? '/'),
    onError: (e) => {
      const err = toApiError(e)
      setErrors(Object.keys(err.fields).length > 0 ? err.fields : { form: err.message })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const parsed = signupBodySchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
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
      <h1 className="text-heading font-bold">Criar conta</h1>
      <p className="text-muted-foreground">Crie sua conta para comprar, favoritar e acompanhar seus pedidos.</p>
      {errors.form ? (
        <p role="alert" className="border border-destructive px-4 py-3 text-body text-destructive">
          {errors.form}
        </p>
      ) : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField label="Nome de usuário" name="username" autoComplete="username" error={errors.username} />
        <TextField label="E-mail" name="email" type="email" autoComplete="email" placeholder="contato@email.com" error={errors.email} />
        <TextField label="Senha" name="password" type="password" autoComplete="new-password" error={errors.password} />
        <TextField label="Confirmar senha" name="confirmPassword" type="password" autoComplete="new-password" error={errors.confirmPassword} />
        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
      <p className="text-body text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect }} className="text-accent underline">
          Entrar
        </Link>
      </p>
    </section>
  )
}
