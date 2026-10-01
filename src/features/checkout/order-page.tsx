import { Link } from '@tanstack/react-router'
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'
import { toApiError } from '@/api/client'
import { useOrder } from '@/api/orders'
import { NotFound } from '@/components/not-found'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatEth, shortAddress } from '@/lib/money'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function OrderPage({ orderId }: { orderId: string }) {
  const { data: order, isPending, error, refetch } = useOrder(orderId)

  if (error && !order) {
    const apiError = toApiError(error)
    if (apiError.kind === 'NOT_FOUND') return <NotFound message="Este pedido não existe." />
    return (
      <section role="alert" className="mx-auto flex max-w-[800px] flex-col items-start gap-4 px-6 py-16">
        <p>{apiError.message}</p>
        <Button onClick={() => void refetch()}>Tentar novamente</Button>
      </section>
    )
  }
  if (isPending) {
    return (
      <div className="mx-auto max-w-[800px] px-6 py-16" aria-busy="true">
        <div className="skeleton h-64" />
      </div>
    )
  }

  const { quote } = order
  return (
    <article className="mx-auto flex max-w-[800px] flex-col gap-8 px-6 py-10" aria-labelledby="order-title">
      {/* Região viva: a mudança de pendente para confirmado/recusado é anunciada. */}
      <header role="status" aria-live="polite" className="flex items-start gap-4">
        {order.status === 'pending' ? (
          <LoaderCircle className="mt-1 size-8 shrink-0 animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
        ) : order.status === 'confirmed' ? (
          <CheckCircle2 className="mt-1 size-8 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <CircleAlert className="mt-1 size-8 shrink-0 text-destructive" aria-hidden="true" />
        )}
        <div>
          <h1 id="order-title" className="text-heading font-bold">
            {order.status === 'pending'
              ? 'Aguardando confirmação do pagamento'
              : order.status === 'confirmed'
                ? 'Compra confirmada'
                : 'Pagamento recusado'}
          </h1>
          <p className="text-muted-foreground">
            {order.status === 'pending'
              ? 'Seu pedido foi criado. A compra só é confirmada quando a rede responder. Você pode sair desta página.'
              : order.status === 'confirmed'
                ? 'Os NFTs foram transferidos para a sua carteira.'
                : (order.declineReason ?? 'A carteira recusou o pagamento.')}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border border-border bg-card p-4 text-body">
        <dt className="text-muted-foreground">Pedido</dt>
        <dd className="break-all font-mono">{order.id}</dd>
        <dt className="text-muted-foreground">Data</dt>
        <dd>{dateTime.format(new Date(order.createdAt))}</dd>
        <dt className="text-muted-foreground">Rede</dt>
        <dd className="capitalize">{order.network}</dd>
        <dt className="text-muted-foreground">Carteira</dt>
        <dd title={order.walletAddress}>{shortAddress(order.walletAddress)}</dd>
        {order.txHash ? (
          <>
            <dt className="text-muted-foreground">Transação</dt>
            <dd className="break-all font-mono text-caption">{order.txHash}</dd>
          </>
        ) : null}
      </dl>

      <section aria-labelledby="items-title">
        <h2 id="items-title" className="mb-3 text-body-lg font-bold">
          Itens
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {quote.lines.map((l) => (
            <li key={l.editionId} className="flex items-center gap-4 py-3">
              <img src={l.image} alt="" width={48} height={48} className="size-12 bg-card object-cover" />
              <span className="min-w-0 flex-1 truncate">
                {l.name} · {l.editionLabel} × {l.quantity}
              </span>
              <span className="tabular-nums">{formatEth(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 ml-auto grid max-w-[320px] grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-body">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatEth(quote.subtotal)}</dd>
          <dt className="text-muted-foreground">Desconto</dt>
          <dd className="text-right tabular-nums">(-) {formatEth(quote.discount)}</dd>
          <dt className="text-muted-foreground">Taxa de rede</dt>
          <dd className="text-right tabular-nums">{formatEth(quote.networkFee, { maxFractionDigits: 6 })}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold tabular-nums text-accent">{formatEth(quote.total, { maxFractionDigits: 6 })}</dd>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        {order.status === 'declined' ? (
          <>
            <Link to="/checkout" className={buttonVariants()}>
              Tentar novamente
            </Link>
            <Link to="/cart" className={buttonVariants({ variant: 'outline' })}>
              Voltar ao carrinho
            </Link>
          </>
        ) : (
          <Link to="/" className={buttonVariants({ variant: order.status === 'confirmed' ? 'default' : 'outline' })}>
            Continuar explorando
          </Link>
        )}
      </div>
    </article>
  )
}
