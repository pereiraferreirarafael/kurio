import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useRef, useState } from 'react'
import { useChangePassword, useSetAvatar, useUpdateProfile } from '@/api/account'
import { ApiError, toApiError } from '@/api/client'
import { passwordBodySchema, profileBodySchema } from '@/api/contracts'
import { sessionQuery } from '@/api/session'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/field'
import { apiFields, zodFields } from '@/lib/form'
import { imageToAvatarDataUrl } from '@/lib/image'
import { AccountNav } from './account-nav'

export function ProfilePage() {
  const { data: session } = useQuery(sessionQuery)
  if (!session) return null
  const { user } = session
  return (
    <div className="mx-auto max-w-[800px] px-6 py-10">
      <h1 className="mb-6 text-heading font-bold">Perfil do colecionador</h1>
      <AccountNav />
      <div className="flex flex-col gap-12">
        <AvatarSection name={user.displayName} avatarUrl={user.avatarUrl} />
        <DataSection user={user} />
        <PasswordSection />
      </div>
    </div>
  )
}

function Notice({ kind, children }: { kind: 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={kind === 'error' ? 'text-body text-destructive' : 'text-body text-success'}
    >
      {kind === 'error' ? <span aria-hidden="true">✕ </span> : <span aria-hidden="true">✓ </span>}
      {children}
    </p>
  )
}

function AvatarSection({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const setAvatar = useSetAvatar()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setMessage(null)
    try {
      const dataUrl = await imageToAvatarDataUrl(file)
      await setAvatar.mutateAsync(dataUrl)
      setMessage({ kind: 'ok', text: 'Foto atualizada.' })
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : e instanceof Error && !('isAxiosError' in e) ? e.message : toApiError(e).message })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <section aria-labelledby="avatar-title" className="flex flex-col gap-4">
      <h2 id="avatar-title" className="text-body-lg font-bold">
        Foto
      </h2>
      <div className="flex flex-wrap items-center gap-6">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Foto de ${name}`} width={96} height={96} className="size-24 rounded-full object-cover" />
        ) : (
          <div aria-hidden="true" className="grid size-24 place-items-center rounded-full bg-surface text-heading font-bold">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="avatar-file"
            aria-label="Escolher foto de perfil"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button variant="outline" disabled={setAvatar.isPending} onClick={() => input.current?.click()}>
            {setAvatar.isPending ? 'Enviando…' : 'Alterar foto'}
          </Button>
          {avatarUrl ? (
            <Button
              variant="ghost"
              disabled={setAvatar.isPending}
              onClick={() =>
                setAvatar.mutate(null, {
                  onSuccess: () => setMessage({ kind: 'ok', text: 'Foto removida.' }),
                  onError: (e) => setMessage({ kind: 'error', text: toApiError(e).message }),
                })
              }
            >
              Remover foto
            </Button>
          ) : null}
        </div>
      </div>
      <div className="min-h-6">{message ? <Notice kind={message.kind}>{message.text}</Notice> : null}</div>
    </section>
  )
}

function DataSection({ user }: { user: { displayName: string; username: string; email: string } }) {
  const update = useUpdateProfile()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (update.isPending) return
    setSaved(false)
    const parsed = profileBodySchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!parsed.success) return setErrors(zodFields(parsed.error))
    setErrors({})
    update.mutate(parsed.data, { onSuccess: () => setSaved(true), onError: (e) => setErrors(apiFields(e)) })
  }

  return (
    <section aria-labelledby="data-title" className="flex flex-col gap-4">
      <h2 id="data-title" className="text-body-lg font-bold">
        Dados da conta
      </h2>
      <form onSubmit={onSubmit} noValidate className="flex max-w-[500px] flex-col gap-5">
        <TextField label="Nome de exibição" name="displayName" defaultValue={user.displayName} error={errors.displayName} autoComplete="name" />
        <TextField label="Nome de usuário" name="username" defaultValue={user.username} error={errors.username} autoComplete="username" />
        <TextField label="E-mail" name="email" type="email" defaultValue={user.email} error={errors.email} autoComplete="email" />
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
          {saved ? <Notice kind="ok">Dados salvos.</Notice> : null}
        </div>
        {errors.form ? <Notice kind="error">{errors.form}</Notice> : null}
      </form>
    </section>
  )
}

function PasswordSection() {
  const change = useChangePassword()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (change.isPending) return
    setSaved(false)
    const form = event.currentTarget
    const parsed = passwordBodySchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!parsed.success) return setErrors(zodFields(parsed.error))
    setErrors({})
    change.mutate(parsed.data, {
      onSuccess: () => {
        form.reset()
        setSaved(true)
      },
      onError: (e) => setErrors(apiFields(e)),
    })
  }

  return (
    <section aria-labelledby="password-title" className="flex flex-col gap-4">
      <h2 id="password-title" className="text-body-lg font-bold">
        Alterar senha
      </h2>
      <form onSubmit={onSubmit} noValidate className="flex max-w-[500px] flex-col gap-5">
        <TextField label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" error={errors.currentPassword} />
        <TextField label="Nova senha" name="newPassword" type="password" autoComplete="new-password" error={errors.newPassword} />
        <TextField label="Confirmar nova senha" name="confirmPassword" type="password" autoComplete="new-password" error={errors.confirmPassword} />
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Alterando…' : 'Alterar senha'}
          </Button>
          {saved ? <Notice kind="ok">Senha alterada.</Notice> : null}
        </div>
        {errors.form ? <Notice kind="error">{errors.form}</Notice> : null}
      </form>
    </section>
  )
}
