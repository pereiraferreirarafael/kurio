import type { CartState, Nft, Order, Wallet } from '@/api/contracts'
import { type UserRecord, buildNfts, buildUsers } from './fixtures'

export interface OrderRecord extends Order {
  userId: string
  /** Quando a simulação decide o desfecho. */
  settleAt: number
  outcome: 'confirm' | 'decline' | 'stall'
}

interface SessionRecord {
  userId: string
  expiresAt: string
}

export interface DbState {
  nfts: Nft[]
  users: UserRecord[]
  sessions: Record<string, SessionRecord>
  favorites: Record<string, string[]>
  carts: Record<string, CartState>
  orders: OrderRecord[]
  wallets: Record<string, Wallet[]>
  walletSeq: number
  /** `${userId}:${Idempotency-Key}` -> hash do conteúdo e pedido criado. */
  idempotency: Record<string, { hash: string; orderId: string }>
  eventSeq: number
  /** E-mails inscritos na newsletter (minúsculos). */
  newsletter: string[]
}

const STORAGE_KEY = 'kurio.mock.db.v1'
export const SESSION_TTL_MS = 30 * 60_000

let state: DbState | null = null

function initial(): DbState {
  return { nfts: buildNfts(), users: buildUsers(), sessions: {}, favorites: {}, carts: {}, orders: [], wallets: {}, walletSeq: 0, idempotency: {}, eventSeq: 0, newsletter: [] }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...initial(), ...(JSON.parse(raw) as Partial<DbState>) }
  } catch {
    /* sem localStorage (testes em Node) ou JSON inválido: recomeça do cenário conhecido */
  }
  return initial()
}

export function getDb(): DbState {
  state ??= load()
  return state
}

export function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getDb()))
  } catch {
    /* noop */
  }
}

/** Restaura integralmente o cenário conhecido. */
export function resetDb(): DbState {
  state = initial()
  saveDb()
  return state
}

export function nextEventId(): string {
  const db = getDb()
  db.eventSeq += 1
  saveDb()
  return `evt_${db.eventSeq}`
}

export function findNft(id: string): Nft | undefined {
  return getDb().nfts.find((n) => n.id === id)
}
