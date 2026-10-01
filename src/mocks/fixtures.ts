import type { Edition, Nft, User } from '@/api/contracts'

/** PRNG determinístico: os fixtures são idênticos a cada reset. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Os 8 primeiros reproduzem os NFTs do Figma.
const FIGMA_SEEDS: Array<[string, string, string]> = [
  ['Emerald Ape', '042', '1.19'],
  ['Sage Nomad', '009', '1.69'],
  ['Neon Vessel', '552', '1.99'],
  ['Cosmic Bloom', '118', '1.29'],
  ['Violet Nomad', '314', '1.39'],
  ['Ivory Baron', '088', '1.79'],
  ['Golden Beat', '207', '0.99'],
  ['Golden Signal', '160', '0.39'],
]
const ADJECTIVES = ['Amber', 'Onyx', 'Lunar', 'Solar', 'Coral', 'Jade', 'Crimson', 'Silver']
const NOUNS = ['Ape', 'Nomad', 'Vessel', 'Bloom', 'Baron', 'Beat', 'Signal', 'Sphinx']
const COLLECTIONS = [
  { slug: 'kurio-apes', name: 'Kurio Apes' },
  { slug: 'kurio-editions', name: 'Kurio Editions' },
  { slug: 'neon-vessels', name: 'Neon Vessels' },
]
const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
const EDITION_TEMPLATES = [
  { label: '1/1', supply: 1 },
  { label: '1/10', supply: 10 },
  { label: '1/50', supply: 50 },
]
const BASE_DATE = Date.UTC(2026, 8, 1, 12)

/** Qual das 4 artes cada um dos 8 NFTs do Figma usa (os demais alternam). */
const FIGMA_ART = [0, 1, 2, 1, 1, 2, 3, 3]
const artFor = (i: number) => FIGMA_ART[i] ?? i % 4

export const NFT_COUNT = 36

export function buildNfts(): Nft[] {
  const rand = mulberry32(2026)
  return Array.from({ length: NFT_COUNT }, (_, i) => {
    const seed = FIGMA_SEEDS[i]
    const name = seed?.[0] ?? `${ADJECTIVES[i % 8]} ${NOUNS[(i * 3 + 1) % 8]}`
    const tokenId = seed?.[1] ?? String(Math.floor(rand() * 900) + 100)
    const price = seed?.[2] ?? (rand() * 9.6 + 0.2).toFixed(2)
    const id = `${slug(name)}-${tokenId}`
    const collection = COLLECTIONS[i % 3]!
    const editions: Edition[] = EDITION_TEMPLATES.map((t, e) => ({
      id: `${id}-e${e + 1}`,
      label: t.label,
      supply: t.supply,
      available: Math.max(1, Math.round(rand() * t.supply)),
    }))
    const hasPrevious = i % 5 === 2
    return {
      id,
      name: `${name} #${tokenId}`,
      tokenId: `#${tokenId.padStart(4, '0')}`,
      collection: collection.name,
      collectionSlug: collection.slug,
      network: NETWORKS[(i + Math.floor(i / 4)) % 3]!,
      price,
      previousPrice: hasPrevious ? (Number(price) * 1.15).toFixed(2) : null,
      image: `/nfts/art-${artFor(i)}-sm.webp`,
      gallery: [0, 1, 2, 3].map((g) => `/nfts/art-${(artFor(i) + g) % 4}.webp`),
      description:
        'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
      attributes: ['Óculos', 'Esmeralda', 'Raro'],
      rating: 4.8,
      reviewCount: 19,
      tags: [
        ...(i < 12 ? (['new'] as const) : []),
        ...(i % 4 === 1 ? (['trending'] as const) : []),
        ...(i % 6 === 0 ? (['rare'] as const) : []),
      ],
      editions,
      version: 1,
      listedAt: new Date(BASE_DATE - i * 6 * 3_600_000).toISOString(),
    }
  })
}

export type UserRecord = User & { passwordHash: string }

/** Credenciais fictícias. Senhas guardadas apenas como hash SHA-256. */
export const DEMO_CREDENTIALS = [
  { email: 'ana@kurio.dev', password: 'Kurio@123' },
  { email: 'bruno@kurio.dev', password: 'Kurio@456' },
] as const

export function buildUsers(): UserRecord[] {
  return [
    {
      id: 'u_1',
      username: 'ana',
      displayName: 'Ana Souza',
      email: 'ana@kurio.dev',
      avatarUrl: null,
      passwordHash: '07a56ab94c03c2f61619ef38a5077b29c008a60cccceafe7fc644c70c149b7c3',
    },
    {
      id: 'u_2',
      username: 'bruno',
      displayName: 'Bruno Lima',
      email: 'bruno@kurio.dev',
      avatarUrl: null,
      passwordHash: '2cd4e415c84cdb59a84b742b87fd79258a87df75331af68ea49310cdfe115e5f',
    },
  ]
}
