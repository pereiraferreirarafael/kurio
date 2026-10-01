import { Link, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useCart, useQuote } from '@/api/cart'
import { toApiError } from '@/api/client'
import type { Quote, QuoteLine } from '@/api/contracts'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { describeQuoteChanges } from './quote-changes'
import { QuantityStepper } from './quantity-stepper'

export function CartPage() {
  const { userId, cart, isLoading, loadError, refetch, setQuantity, coupon } = useCart()
  const quoteQuery = useQuote(cart, userId ?? 'guest')
  const quote = quoteQuery.data
  const navigate = useNavigate()

  // Avisa (região viva) o que mudou quando uma nova cotação chega por tempo real ou revalidação.
  const last = useRef<Quote | undefined>(undefined)
  const [changes, setChanges] = useState<string[]>([])
  useEffect(() => {
    if (!quote || quoteQuery.isPlaceholderData) return
    if (last.current && last.current.fingerprint !== quote.fingerprint) {
      const found = describeQuoteChanges(last.current, quote)
      if (found.length > 0) setChanges(found)
    }
    last.current = quote
  }, [quote, quoteQuery.isPlaceholderData])

  if (loadError && !isLoading) {
    return (
      <section role="alert" className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 py-16">
        <p>{toApiError(loadError).message}</p>
        <Button onClick={() => void refetch()}>Tentar novamente</Button>
      </section>
    )
  }

  if (!isLoading && cart.items.length === 0) {
    return (
      <section className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 py-16">
        <h1 className="text-heading font-bold">Seu carrinho</h1>
        <p className="text-muted-foreground">Seu carrinho está vazio. Explore o catálogo e adicione NFTs.</p>
        <Link to="/" className={buttonVariants()}>
          Explorar NFTs
        </Link>
      </section>
    )
  }

  const pending = quoteQuery.isPlaceholderData || quoteQuery.isFetching
  const canCheckout = Boolean(quote?.canCheckout) && !quoteQuery.isPlaceholderData && !setQuantity.isPending

  function goToCheckout() {
    if (userId) void navigate({ to: '/checkout' })
    else void navigate({ to: '/login', search: { redirect: '/checkout' } })
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-10 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="cart-title" className="min-w-0">
        <h1 id="cart-title" className="mb-6 text-heading font-bold">
          Seu carrinho
        </h1>

        <div role="status" aria-live="polite">
          {changes.length > 0 ? (
            <div className="mb-4 border border-accent bg-card px-4 py-3 text-body">
              <p className="font-bold">O carrinho foi atualizado:</p>
              <ul className="list-disc pl-5">
                {changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <button type="button" className="mt-2 text-accent underline" onClick={() => setChanges([])}>
                Dispensar aviso
              </button>
            </div>
          ) : null}
        </div>

        {setQuantity.isError ? (
          <p role="alert" className="mb-4 border border-destructive px-4 py-3 text-body text-destructive">
            {toApiError(setQuantity.error).message}
          </p>
        ) : null}
        {quoteQuery.isError && !quote ? (
          <p role="alert" className="mb-4 flex items-center gap-4 border border-destructive px-4 py-3 text-body text-destructive">
            Não foi possível calcular o total. {toApiError(quoteQuery.error).message}
            <Button size="sm" variant="outline" onClick={() => void quoteQuery.refetch()}>
              Tentar novamente
            </Button>
          </p>
        ) : null}

        <ul className="flex flex-col divide-y divide-border border-y border-border" aria-busy={isLoading}>
          {isLoading || !quote
            ? cart.items.concat(cart.items.length ? [] : [{ nftId: '', editionId: 'sk', quantity: 1 }]).map((i) => (
                <li key={i.editionId} className="skeleton h-[104px]" />
              ))
            : quote.lines.map((line) => (
                <CartRow
                  key={line.editionId}
                  line={line}
                  busy={setQuantity.isPending}
                  onQuantity={(q) => setQuantity.mutate({ nftId: line.nftId, editionId: line.editionId, quantity: q })}
                />
              ))}
        </ul>
        <p className="mt-4">
          <Link to="/" className="text-accent underline">
            Continuar explorando
          </Link>
        </p>
      </section>

      <aside aria-labelledby="summary-title" className="h-fit border border-border bg-card p-6">
        <h2 id="summary-title" className="mb-4 text-body-lg font-bold">
          Resumo da carteira
        </h2>
        <CouponForm
          applied={cart.coupon}
          pending={coupon.isPending}
          error={coupon.isError ? (toApiError(coupon.error).fields.coupon ?? toApiError(coupon.error).message) : undefined}
          onApply={(code) => coupon.mutate(code)}
          onRemove={() => coupon.mutate(null)}
        />
        <dl className={cn('mt-6 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-body', pending && 'opacity-70')} aria-busy={pending}>
          <Row label="Subtotal" value={quote ? formatEth(quote.subtotal) : undefined} />
          <Row
            label={quote?.coupon?.status === 'applied' ? `Desconto (${quote.coupon.code})` : 'Desconto do lançamento'}
            value={quote ? `(-) ${formatEth(quote.discount)}` : undefined}
          />
          <Row label="Taxa de rede (estimada)" value={quote ? formatEth(quote.networkFee, { maxFractionDigits: 6 }) : undefined} />
          <div className="col-span-2 my-2 border-t border-border" />
          <Row label="Total" value={quote ? formatEth(quote.total, { maxFractionDigits: 6 }) : undefined} strong />
        </dl>

        {quote && quote.issues.length > 0 ? (
          <ul role="alert" className="mt-4 list-disc pl-5 text-caption text-destructive">
            {quote.issues.map((i) => (
              <li key={i.type + (i.editionId ?? '')}>{i.message}</li>
            ))}
          </ul>
        ) : null}

        <Button size="lg" className="mt-6 w-full" disabled={!canCheckout} onClick={goToCheckout}>
          {userId ? 'Finalizar compra' : 'Conectar e finalizar'}
        </Button>
        {!userId ? <p className="mt-2 text-caption text-muted-foreground">Entre para concluir. Seu carrinho será mantido.</p> : null}
      </aside>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  return (
    <>
      <dt className={cn(strong ? 'font-bold' : 'text-muted-foreground')}>{label}</dt>
      <dd className={cn('text-right tabular-nums', strong && 'font-bold text-accent')}>
        {value ?? <span className="skeleton inline-block h-4 w-20 align-middle" />}
      </dd>
    </>
  )
}

function CartRow({ line, onQuantity, busy }: { line: QuoteLine; onQuantity: (q: number) => void; busy: boolean }) {
  const problem = line.status !== 'ok'
  return (
    <li className="grid grid-cols-[72px_1fr] gap-x-4 gap-y-2 py-4 sm:grid-cols-[72px_1fr_auto_auto_auto] sm:items-center">
      <img src={line.image} alt="" width={72} height={72} className="size-[72px] bg-background object-cover" />
      <div className="min-w-0">
        <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="block truncate font-medium hover:underline">
          {line.name}
        </Link>
        <p className="text-caption text-muted-foreground">
          Edição {line.editionLabel} · {formatEth(line.unitPrice)}
        </p>
        {problem ? (
          <p className="text-caption text-destructive">
            {line.status === 'sold_out' ? 'Esgotado. Remova este item para continuar.' : `Restam ${line.available}. Reduza a quantidade.`}
          </p>
        ) : null}
      </div>
      <div className="col-start-2 sm:col-start-auto">
        <QuantityStepper
          label={`quantidade de ${line.name}`}
          value={line.quantity}
          max={Math.max(line.available, 1)}
          disabled={busy}
          onChange={onQuantity}
        />
      </div>
      <span className="col-start-2 font-bold tabular-nums sm:col-start-auto sm:text-right">{formatEth(line.lineTotal)}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remover ${line.name} do carrinho`}
        className="col-start-2 justify-self-start sm:col-start-auto"
        onClick={() => onQuantity(0)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </li>
  )
}

function CouponForm(props: {
  applied: string | null
  pending: boolean
  error?: string
  onApply: (code: string) => void
  onRemove: () => void
}) {
  const [code, setCode] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (code.trim() && !props.pending) props.onApply(code.trim())
  }
  if (props.applied) {
    return (
      <p className="flex items-center justify-between gap-3 text-body">
        <span>
          Cupom <strong>{props.applied}</strong> aplicado
        </span>
        <button type="button" className="text-accent underline" disabled={props.pending} onClick={props.onRemove}>
          Remover
        </button>
      </p>
    )
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="coupon" className="text-body font-medium">
        Código promocional
      </label>
      <div className="flex gap-2">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 border border-border-strong bg-background px-3 text-body"
        />
        <Button type="submit" variant="outline" disabled={props.pending || !code.trim()}>
          Aplicar
        </Button>
      </div>
      {props.error ? (
        <p id="coupon-error" role="alert" className="text-caption text-destructive">
          <span aria-hidden="true">✕ </span>
          {props.error}
        </p>
      ) : null}
    </form>
  )
}
