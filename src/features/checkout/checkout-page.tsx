import { useNavigate } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useCart, useQuote } from '@/api/cart'
import { toApiError } from '@/api/client'
import { type CreateOrderBody, type Network, type Quote, type WalletConnection } from '@/api/contracts'
import { useWallets } from '@/api/account'
import { useConnectWallet, useCreateOrder } from '@/api/orders'
import { Button, buttonVariants } from '@/components/ui/button'
import { describeQuoteChanges } from '@/features/cart/quote-changes'
import { formatEth, shortAddress } from '@/lib/money'
import { cn } from '@/lib/utils'

const NETWORKS: { id: Network; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
]


export function CheckoutPage() {
  const navigate = useNavigate()
  const { userId, cart, isLoading } = useCart()
  const quoteQuery = useQuote(cart, userId ?? 'guest')
  const quote = quoteQuery.data
  const [network, setNetwork] = useState<Network>('ethereum')
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const connect = useConnectWallet()
  // Carteiras cadastradas em /wallets: a principal vem pré-selecionada (se for da rede escolhida).
  const savedWallets = useWallets().data ?? []
  const savedOnNetwork = savedWallets.filter((w) => w.network === network)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const selectedSaved =
    savedOnNetwork.find((w) => w.id === pickedId) ?? savedOnNetwork.find((w) => w.isPrimary) ?? savedOnNetwork[0]
  const createOrder = useCreateOrder()
  // Última tentativa enviada: repetir após timeout reutiliza o MESMO conteúdo (e, portanto, a mesma chave).
  const [lastBody, setLastBody] = useState<CreateOrderBody | null>(null)
  const submitErr = createOrder.isError ? toApiError(createOrder.error) : null
  const uncertain = submitErr?.isTransient ?? false

  // Reconfirmação: qualquer mudança de valores depois da primeira exibição é apontada
  // e o botão passa a exigir confirmação explícita dos novos valores.
  const shown = useRef<Quote | undefined>(undefined)
  const [changes, setChanges] = useState<string[]>([])
  useEffect(() => {
    if (!quote || quoteQuery.isPlaceholderData) return
    if (shown.current && shown.current.fingerprint !== quote.fingerprint) {
      const found = describeQuoteChanges(shown.current, quote)
      setChanges(found.length > 0 ? found : ['Os valores do pedido foram atualizados.'])
    }
    shown.current = quote
  }, [quote, quoteQuery.isPlaceholderData])

  // Com envio em andamento ou incerto o carrinho pode já ter sido esvaziado pelo servidor: não mostre "vazio".
  if (!isLoading && cart.items.length === 0 && !createOrder.isPending && !uncertain) {
    return (
      <section className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 py-16">
        <h1 className="text-heading font-bold">Pagamento</h1>
        <p className="text-muted-foreground">Não há itens para pagar. Adicione NFTs ao carrinho primeiro.</p>
        <Link to="/" className={buttonVariants()}>
          Explorar NFTs
        </Link>
      </section>
    )
  }

  const walletError = connect.isError ? toApiError(connect.error).message : null
  const submitError = submitErr
  const stale = quoteQuery.isPlaceholderData || quoteQuery.isFetching
  const canRetry = uncertain && lastBody !== null && !createOrder.isPending
  const canPay = canRetry || Boolean(quote?.canCheckout && wallet && !stale && !createOrder.isPending)

  function pickNetwork(next: Network) {
    setNetwork(next)
    setWallet(null) // o endereço é por rede: trocar de rede desconecta a carteira
    connect.reset()
  }

  function connectWallet() {
    connect.mutate({ network, walletId: selectedSaved?.id }, { onSuccess: setWallet })
  }

  function pay() {
    const body: CreateOrderBody | null =
      uncertain && lastBody
        ? lastBody
        : quote && wallet
          ? {
              items: cart.items,
              coupon: cart.coupon,
              quoteFingerprint: quote.fingerprint,
              network,
              walletAddress: wallet.address,
            }
          : null
    if (!body) return
    setLastBody(body)
    setChanges([])
    createOrder.mutate(
      body,
      {
        onSuccess: (order) => void navigate({ to: '/orders/$orderId', params: { orderId: order.id } }),
        onError: (e) => {
          // Valores mudaram no servidor: busca a cotação nova e exige nova confirmação.
          if (toApiError(e).fields.reason === 'QUOTE_CHANGED') void quoteQuery.refetch()
        },
      },
    )
  }

  const reason = submitError?.fields.reason

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-10 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="pay-title" className="flex min-w-0 flex-col gap-8">
        <h1 id="pay-title" className="text-heading font-bold">
          Pagamento
        </h1>

        <div role="status" aria-live="polite">
          {changes.length > 0 ? (
            <div className="border border-accent bg-card px-4 py-3 text-body">
              <p className="font-bold">Os valores mudaram. Revise e confirme novamente:</p>
              <ul className="list-disc pl-5">
                {changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-body-lg font-bold">1. Rede</legend>
          <div className="flex flex-wrap gap-3">
            {NETWORKS.map((n) => (
              <label
                key={n.id}
                className={cn(
                  'cursor-pointer border px-4 py-2 text-body has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  n.id === network ? 'border-accent text-accent' : 'border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="network"
                  className="sr-only"
                  checked={n.id === network}
                  onChange={() => pickNetwork(n.id)}
                  disabled={createOrder.isPending}
                />
                {n.label}
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-labelledby="wallet-title" className="flex flex-col gap-3">
          <h2 id="wallet-title" className="text-body-lg font-bold">
            2. Carteira
          </h2>
          {wallet ? (
            <div className="flex flex-wrap items-center gap-4 border border-border bg-card px-4 py-3">
              <span className="text-body">
                Conectada: <strong title={wallet.address}>{shortAddress(wallet.address)}</strong> ({network})
              </span>
              <Button size="sm" variant="outline" disabled={createOrder.isPending} onClick={() => setWallet(null)}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              {savedOnNetwork.length > 0 ? (
                <fieldset className="flex w-full flex-col gap-2">
                  <legend className="mb-1 text-body text-muted-foreground">Carteiras cadastradas na rede escolhida</legend>
                  {savedOnNetwork.map((w) => (
                    <label
                      key={w.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border px-4 py-2 text-body has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                        w.id === selectedSaved?.id ? 'border-accent' : 'border-border-strong',
                      )}
                    >
                      <input
                        type="radio"
                        name="saved-wallet"
                        checked={w.id === selectedSaved?.id}
                        onChange={() => setPickedId(w.id)}
                      />
                      <span className="font-bold">{w.label}</span>
                      <span className="text-muted-foreground" title={w.address}>
                        {shortAddress(w.address)}
                      </span>
                      {w.isPrimary ? <span className="ml-auto text-caption text-accent">Principal</span> : null}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p className="text-muted-foreground">
                  Nenhuma carteira cadastrada nesta rede. Conecte uma carteira simulada ou{' '}
                  <Link to="/wallets" className="text-accent underline">
                    cadastre uma em Carteiras
                  </Link>
                  .
                </p>
              )}
              <Button variant="outline" disabled={connect.isPending} onClick={connectWallet}>
                {connect.isPending ? 'Aguardando a carteira…' : 'Conectar carteira'}
              </Button>
              {walletError ? (
                <p role="alert" className="text-body text-destructive">
                  <span aria-hidden="true">✕ </span>
                  {walletError} Tente conectar novamente.
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section aria-labelledby="review-title" className="flex flex-col gap-3">
          <h2 id="review-title" className="text-body-lg font-bold">
            3. Revisão
          </h2>
          <ul className="divide-y divide-border border-y border-border" aria-busy={!quote}>
            {(quote?.lines ?? []).map((l) => (
              <li key={l.editionId} className="flex items-center gap-4 py-3">
                <img src={l.image} alt="" width={48} height={48} className="size-12 bg-card object-cover" />
                <span className="min-w-0 flex-1 truncate">
                  {l.name} · {l.editionLabel} × {l.quantity}
                </span>
                <span className="tabular-nums">{formatEth(l.lineTotal)}</span>
              </li>
            ))}
            {!quote ? <li className="skeleton h-16" /> : null}
          </ul>
        </section>
      </section>

      <aside aria-labelledby="total-title" className="h-fit border border-border bg-card p-6">
        <h2 id="total-title" className="mb-4 text-body-lg font-bold">
          Resumo do pedido
        </h2>
        <dl className={cn('grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-body', stale && 'opacity-70')} aria-busy={stale}>
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right tabular-nums">{quote ? formatEth(quote.subtotal) : '—'}</dd>
          <dt className="text-muted-foreground">Desconto</dt>
          <dd className="text-right tabular-nums">{quote ? `(-) ${formatEth(quote.discount)}` : '—'}</dd>
          <dt className="text-muted-foreground">Taxa de rede</dt>
          <dd className="text-right tabular-nums">{quote ? formatEth(quote.networkFee, { maxFractionDigits: 6 }) : '—'}</dd>
          <div className="col-span-2 my-2 border-t border-border" />
          <dt className="font-bold">Total</dt>
          <dd className="text-right font-bold tabular-nums text-accent">{quote ? formatEth(quote.total, { maxFractionDigits: 6 }) : '—'}</dd>
        </dl>

        {quote && quote.issues.length > 0 ? (
          <ul role="alert" className="mt-4 list-disc pl-5 text-caption text-destructive">
            {quote.issues.map((i) => (
              <li key={i.type + (i.editionId ?? '')}>{i.message}</li>
            ))}
          </ul>
        ) : null}

        {submitError ? (
          <div role="alert" className="mt-4 flex flex-col gap-2 border border-destructive px-3 py-2 text-caption text-destructive">
            {uncertain ? (
              <p>
                Não conseguimos confirmar se o pedido foi criado. Você pode tentar de novo com segurança: a tentativa
                não gera cobrança duplicada.
              </p>
            ) : (
              <p>{submitError.message}</p>
            )}
            {reason === 'UNAVAILABLE' ? (
              <Link to="/cart" className="underline">
                Ajustar carrinho
              </Link>
            ) : null}
          </div>
        ) : null}

        <Button size="lg" className="mt-6 w-full" disabled={!canPay} onClick={pay}>
          {createOrder.isPending
            ? 'Enviando pedido…'
            : uncertain
              ? 'Tentar novamente'
              : changes.length > 0
                ? 'Confirmar novos valores'
                : 'Confirmar pagamento'}
        </Button>
        {!wallet ? <p className="mt-2 text-caption text-muted-foreground">Conecte uma carteira para continuar.</p> : null}
        <p className="mt-4 text-center">
          <Link to="/cart" className="text-accent underline">
            Voltar ao carrinho
          </Link>
        </p>
      </aside>
    </div>
  )
}
