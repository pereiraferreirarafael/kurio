import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { type NftListParams, type NftListResponse, nftListParamsSchema } from '@/api/contracts'
import { nftListQuery } from '@/api/nfts'
import { cn } from '@/lib/utils'
import { PriceRange } from './price-range'

const NETWORK_LABEL = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' } as const

const option = (active: boolean) =>
  cn(
    'flex items-center justify-between text-[15px] leading-10 hover:text-foreground',
    active ? 'text-accent' : 'text-muted-foreground',
  )

const panelTitle = 'mb-3 text-[18px] font-bold leading-4'
const FEATURED_PARAMS = nftListParamsSchema.parse({ tab: 'trending' })

/** "NFT em destaque": o primeiro NFT em alta. Dado real da API, não imagem fixa. */
function FeaturedBanner() {
  // O banner só existe no desktop (lg+): no celular nem busca os dados.
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const { data } = useQuery({ ...nftListQuery(FEATURED_PARAMS), enabled: wide })
  if (!wide) return null
  const nft = data?.items[0]
  if (!nft) return <div aria-hidden="true" className="skeleton hidden h-[470px] lg:block" />
  return (
    <aside
      aria-labelledby="titulo-destaque"
      className="hidden overflow-hidden bg-gradient-to-b from-primary/10 to-primary/[0.03] pb-1 pt-6 lg:block"
    >
      <div className="flex flex-col gap-4">
        <h2 id="titulo-destaque" className="px-5 text-heading font-bold leading-8 text-accent">
          NFT EM DESTAQUE
        </h2>
        <p className="px-5 text-center text-[22px] font-bold leading-4">OFERTA LIMITADA</p>
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} aria-label={`Ver ${nft.name}`} className="block">
          <img
            src={nft.image}
            alt={`Arte de ${nft.name}`}
            width={310}
            height={368}
            loading="lazy"
            className="h-[368px] w-full rounded-[22px] object-cover"
          />
        </Link>
      </div>
    </aside>
  )
}

interface FiltersProps {
  search: NftListParams
  facets: NftListResponse['facets'] | undefined
}

export function Filters({ search, facets }: FiltersProps) {
  const navigate = useNavigate({ from: '/' })
  const [text, setText] = useState(search.q ?? '')

  // Volta/avança do histórico altera a URL: o campo acompanha.
  useEffect(() => setText(search.q ?? ''), [search.q])

  // Debounce: só atualiza a URL (e reinicia a paginação) depois que a pessoa para de digitar.
  useEffect(() => {
    const value = text.trim()
    if (value === (search.q ?? '')) return
    const timer = setTimeout(() => {
      void navigate({ search: (prev) => ({ ...prev, q: value || undefined, page: 1 }), replace: true })
    }, 300)
    return () => clearTimeout(timer)
  }, [text, search.q, navigate])

  return (
    <div className="flex flex-col gap-6">
      <aside aria-label="Filtros" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="busca" className="text-body font-bold">
            Buscar NFTs
          </label>
          <input
            id="busca"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nome, coleção ou token"
            className="h-10 rounded-md border border-border-strong bg-card px-4 text-body placeholder:text-muted-foreground/70"
          />
        </div>

        <div className="flex flex-col gap-10 bg-card p-5">
          <nav aria-label="Coleções">
            <h2 className={panelTitle}>Coleções</h2>
            <ul className="px-3">
              {!facets
                ? [0, 1, 2].map((i) => <li key={i} aria-hidden="true" className="skeleton h-10" />)
                : null}
              {(facets?.collections ?? []).map((c) => (
                <li key={c.slug}>
                  <Link
                    from="/"
                    to="/"
                    search={(prev) => ({ ...prev, collection: prev.collection === c.slug ? undefined : c.slug, page: 1 })}
                    aria-current={search.collection === c.slug ? 'true' : undefined}
                    className={option(search.collection === c.slug)}
                  >
                    <span className={search.collection === c.slug ? '' : 'font-normal'}>{c.name}</span>
                    <span className="font-bold">({c.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="titulo-preco">
            <h2 id="titulo-preco" className={panelTitle}>
              Faixa de preço
            </h2>
            <PriceRange
              search={search}
              onApply={(range) =>
                void navigate({ search: (prev) => ({ ...prev, ...range, page: 1 }) })
              }
            />
          </section>

          <nav aria-label="Redes">
            <h2 className={panelTitle}>Rede</h2>
            <ul className="pl-3">
              {!facets
                ? [0, 1, 2].map((i) => <li key={i} aria-hidden="true" className="skeleton h-10" />)
                : null}
              {(facets?.networks ?? []).map((n) => (
                <li key={n.network}>
                  <Link
                    from="/"
                    to="/"
                    search={(prev) => ({ ...prev, network: prev.network === n.network ? undefined : n.network, page: 1 })}
                    aria-current={search.network === n.network ? 'true' : undefined}
                    className={option(search.network === n.network)}
                  >
                    <span>{NETWORK_LABEL[n.network]}</span>
                    <span>({n.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
      <FeaturedBanner />
    </div>
  )
}
