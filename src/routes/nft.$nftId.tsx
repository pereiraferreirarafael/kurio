import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toApiError } from '@/api/client'
import { nftDetailQuery } from '@/api/nfts'
import { PurchasePanel } from '@/features/cart/purchase-panel'
import { NotFound } from '@/components/not-found'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQuery(params.nftId))
  },
  component: NftDetail,
})

function NftDetail() {
  const { nftId } = Route.useParams()
  const { data: nft, isPending, error, refetch } = useQuery(nftDetailQuery(nftId))
  const [selected, setSelected] = useState(0)

  if (error && !nft) {
    const apiError = toApiError(error)
    if (apiError.kind === 'NOT_FOUND') return <NotFound message="Este NFT não existe ou foi removido." />
    return (
      <section role="alert" className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 py-16">
        <p>{apiError.message}</p>
        <Button onClick={() => void refetch()}>Tentar novamente</Button>
      </section>
    )
  }

  if (isPending) {
    return (
      <div className="mx-auto grid min-h-[1340px] max-w-[1200px] content-start gap-10 px-6 py-10 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-busy="true">
        <div className="skeleton aspect-square" />
        <div className="flex flex-col gap-4">
          <div className="skeleton h-9 w-2/3" />
          <div className="skeleton h-5 w-1/4" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    )
  }

  return (
    <article className="mx-auto grid max-w-[1200px] gap-10 px-6 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 sm:flex-row-reverse">
        <div className="grid aspect-square min-w-0 flex-1 place-items-center self-start bg-card">
          <img src={nft.gallery[selected] ?? nft.image} alt={`Arte de ${nft.name}`} width={404} height={404} className="w-[91%] max-w-[450px]" />
        </div>
        <ul className="flex gap-3 sm:flex-col">
          {nft.gallery.map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`}
                aria-current={i === selected ? 'true' : undefined}
                className={cn('size-[72px] border bg-card', i === selected ? 'border-accent' : 'border-border')}
              >
                <img src={src} alt="" width={72} height={72} className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-6">
        <h1 className="text-heading font-bold">{nft.name}</h1>
        {/* Região viva: mudanças de preço recebidas em tempo real são anunciadas. */}
        <p aria-live="polite" className="flex items-center gap-3 text-body-lg">
          <span className="font-bold text-accent">{formatEth(nft.price)}</span>
          {nft.previousPrice ? (
            <s className="text-muted-foreground">
              <span className="sr-only">Preço anterior </span>
              {formatEth(nft.previousPrice)}
            </s>
          ) : null}
        </p>
        <p className="text-muted-foreground">{nft.description}</p>
        <PurchasePanel nft={nft} />
        <dl className="grid gap-1 text-body text-muted-foreground">
          <div className="flex gap-2">
            <dt>ID do token:</dt>
            <dd>{nft.tokenId}</dd>
          </div>
          <div className="flex gap-2">
            <dt>Coleção:</dt>
            <dd>{nft.collection}</dd>
          </div>
          <div className="flex gap-2">
            <dt>Atributos:</dt>
            <dd>{nft.attributes.join(', ')}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
