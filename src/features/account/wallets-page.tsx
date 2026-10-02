import { type FormEvent, useState } from 'react'
import { useAddWallet, useRemoveWallet, useSetPrimaryWallet, useWallets } from '@/api/account'
import { toApiError } from '@/api/client'
import { MAX_WALLETS, type Network, type Wallet, addWalletBodySchema } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { apiFields, zodFields } from '@/lib/form'
import { shortAddress } from '@/lib/money'
import { cn } from '@/lib/utils'
import { AccountNav } from './account-nav'

const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

export function WalletsPage() {
  const wallets = useWallets()
  const add = useAddWallet()
  const setPrimary = useSetPrimaryWallet()
  const remove = useRemoveWallet()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [network, setNetwork] = useState<Network>('ethereum')
  const [actionError, setActionError] = useState<string | null>(null)

  const list = wallets.data ?? []
  const atLimit = list.length >= MAX_WALLETS

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (add.isPending) return
    const form = event.currentTarget
    const parsed = addWalletBodySchema.safeParse({ network, label: new FormData(form).get('label') })
    if (!parsed.success) return setErrors(zodFields(parsed.error))
    setErrors({})
    add.mutate(parsed.data, {
      onSuccess: () => form.reset(),
      onError: (e) => setErrors(apiFields(e)),
    })
  }

  const fail = (e: unknown) => setActionError(toApiError(e).message)

  return (
    <div className="mx-auto max-w-[800px] px-6 py-10">
      <h1 className="mb-6 text-heading font-bold">Carteiras</h1>
      <AccountNav />

      <div role="alert" className="min-h-0">
        {actionError ? <p className="mb-4 border border-destructive px-4 py-3 text-body text-destructive">{actionError}</p> : null}
      </div>

      <section aria-labelledby="list-title" className="mb-12">
        <h2 id="list-title" className="mb-3 text-body-lg font-bold">
          Suas carteiras
        </h2>
        {wallets.isPending ? (
          <div className="skeleton h-24" aria-busy="true" />
        ) : wallets.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3 text-destructive">
            <p>{toApiError(wallets.error).message}</p>
            <Button variant="outline" onClick={() => void wallets.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground">Você ainda não tem carteiras. Adicione a primeira abaixo: ela será a principal.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((w) => (
              <WalletRow
                key={w.id}
                wallet={w}
                confirming={confirming === w.id}
                busy={setPrimary.isPending || remove.isPending}
                onPrimary={() => {
                  setActionError(null)
                  setPrimary.mutate(w.id, { onError: fail })
                }}
                onAskRemove={() => setConfirming(w.id)}
                onCancel={() => setConfirming(null)}
                onRemove={() => {
                  setActionError(null)
                  setConfirming(null)
                  remove.mutate(w.id, { onError: fail })
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add-title">
        <h2 id="add-title" className="mb-3 text-body-lg font-bold">
          Adicionar carteira
        </h2>
        {atLimit ? (
          <p className="text-muted-foreground">Você atingiu o limite de {MAX_WALLETS} carteiras. Remova uma para adicionar outra.</p>
        ) : (
          <form onSubmit={onAdd} noValidate className="flex max-w-[500px] flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-body font-medium">Rede</legend>
              <div className="flex flex-wrap gap-3">
                {(Object.keys(NETWORK_LABEL) as Network[]).map((n) => (
                  <label
                    key={n}
                    className={cn(
                      'cursor-pointer border px-4 py-2 text-body has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                      n === network ? 'border-accent text-accent' : 'border-border-strong',
                    )}
                  >
                    <input type="radio" name="network" className="sr-only" checked={n === network} onChange={() => setNetwork(n)} />
                    {NETWORK_LABEL[n]}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField label="Nome da carteira" name="label" placeholder="Ex.: Carteira principal" error={errors.label} />
            {errors.form ? <p role="alert" className="text-body text-destructive">{errors.form}</p> : null}
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? 'Adicionando…' : 'Adicionar carteira'}
            </Button>
          </form>
        )}
      </section>
    </div>
  )
}

function WalletRow(props: {
  wallet: Wallet
  confirming: boolean
  busy: boolean
  onPrimary: () => void
  onAskRemove: () => void
  onCancel: () => void
  onRemove: () => void
}) {
  const { wallet: w } = props
  return (
    <li className="flex flex-col gap-3 border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="truncate">{w.label}</span>
          <span
            className={cn(
              'px-2 text-caption font-bold uppercase',
              w.isPrimary ? 'bg-primary text-primary-foreground' : 'border border-border-strong text-muted-foreground',
            )}
          >
            {w.isPrimary ? 'Principal' : 'Secundária'}
          </span>
        </p>
        <p className="text-caption text-muted-foreground">
          {NETWORK_LABEL[w.network]} · <span title={w.address}>{shortAddress(w.address)}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!w.isPrimary ? (
          <Button size="sm" variant="outline" disabled={props.busy} onClick={props.onPrimary} aria-label={`Tornar ${w.label} a carteira principal`}>
            Tornar principal
          </Button>
        ) : null}
        <Dialog open={props.confirming} onOpenChange={(open) => (open ? props.onAskRemove() : props.onCancel())}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" disabled={props.busy} aria-label={`Remover ${w.label}`}>
              Remover
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle className="text-body-lg font-bold">Remover carteira?</DialogTitle>
            <DialogDescription className="text-body text-muted-foreground">
              {w.label} ({NETWORK_LABEL[w.network]}) será removida da sua conta. Essa ação não pode ser desfeita.
            </DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button size="sm" variant="ghost">
                  Cancelar
                </Button>
              </DialogClose>
              <Button size="sm" onClick={props.onRemove} aria-label={`Confirmar remoção de ${w.label}`}>
                Confirmar remoção
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </li>
  )
}
