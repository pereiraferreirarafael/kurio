import { type Nft, type NftListParams, type NftListResponse, NFT_PAGE_SIZE } from '@/api/contracts'
import { compareEth } from '@/lib/money'
import { getDb } from './db'
import { activeScenario } from './scenarios'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function matches(nft: Nft, p: NftListParams): boolean {
  if (p.q) {
    const haystack = normalize(`${nft.name} ${nft.collection} ${nft.tokenId}`)
    if (!haystack.includes(normalize(p.q))) return false
  }
  if (p.collection && nft.collectionSlug !== p.collection) return false
  if (p.network && nft.network !== p.network) return false
  if (p.minPrice && compareEth(nft.price, p.minPrice) < 0) return false
  if (p.maxPrice && compareEth(nft.price, p.maxPrice) > 0) return false
  if (p.tab !== 'all' && !nft.tags.includes(p.tab)) return false
  return true
}

const sorters: Record<NftListParams['sort'], (a: Nft, b: Nft) => number> = {
  recent: (a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt),
  price_asc: (a, b) => compareEth(a.price, b.price),
  price_desc: (a, b) => compareEth(b.price, a.price),
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

export function listNfts(params: NftListParams): NftListResponse {
  const all = activeScenario().emptyCatalog ? [] : getDb().nfts
  const filtered = all.filter((n) => matches(n, params)).sort(sorters[params.sort])
  const total = filtered.length
  const start = (params.page - 1) * NFT_PAGE_SIZE

  const collections = new Map<string, { slug: string; name: string; count: number }>()
  const networks = new Map<Nft['network'], number>()
  for (const n of all) {
    const c = collections.get(n.collectionSlug) ?? { slug: n.collectionSlug, name: n.collection, count: 0 }
    collections.set(n.collectionSlug, { ...c, count: c.count + 1 })
    networks.set(n.network, (networks.get(n.network) ?? 0) + 1)
  }

  return {
    items: filtered.slice(start, start + NFT_PAGE_SIZE),
    page: params.page,
    pageSize: NFT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / NFT_PAGE_SIZE)),
    facets: {
      collections: [...collections.values()],
      networks: [...networks].map(([network, count]) => ({ network, count })),
    },
  }
}
