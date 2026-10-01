/**
 * Contratos REST e de eventos. Fonte única de verdade: o MSW, o cliente Axios,
 * o TanStack Router (search params) e a UI importam daqui.
 */
import { z } from 'zod'
import { isEthString } from '@/lib/money'

export const ethString = z.string().refine(isEthString, 'Valor ETH inválido')

export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof networkSchema>

export const editionSchema = z.object({
  id: z.string(),
  label: z.string(),
  supply: z.number().int().positive(),
  available: z.number().int().nonnegative(),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSchema = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  collection: z.string(),
  collectionSlug: z.string(),
  network: networkSchema,
  price: ethString,
  previousPrice: ethString.nullable(),
  image: z.string(),
  gallery: z.array(z.string()),
  description: z.string(),
  attributes: z.array(z.string()),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  tags: z.array(z.enum(['new', 'trending', 'rare'])),
  editions: z.array(editionSchema),
  /** Incrementa a cada mudança de preço/disponibilidade. Base da ordenação de eventos. */
  version: z.number().int().nonnegative(),
  listedAt: z.iso.datetime(),
})
export type Nft = z.infer<typeof nftSchema>

// ---- Listagem -------------------------------------------------------------

export const NFT_PAGE_SIZE = 9

const optionalText = z.coerce.string().trim().min(1).optional().catch(undefined)
// O router faz JSON.parse dos search params ("0.5" vira number). Coagimos de volta para string.
const optionalEth = z.coerce.string().refine(isEthString).optional().catch(undefined)

export const nftTabSchema = z.enum(['all', 'new', 'trending'])
export const nftSortSchema = z.enum(['recent', 'price_asc', 'price_desc', 'name'])

/** Usado como validateSearch da rota e como querystring da API. */
export const nftListParamsSchema = z.object({
  q: optionalText,
  collection: optionalText,
  network: networkSchema.optional().catch(undefined),
  minPrice: optionalEth,
  maxPrice: optionalEth,
  tab: nftTabSchema.default('all').catch('all'),
  sort: nftSortSchema.default('recent').catch('recent'),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type NftListParams = z.infer<typeof nftListParamsSchema>

export const nftListResponseSchema = z.object({
  items: z.array(nftSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    collections: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
    networks: z.array(z.object({ network: networkSchema, count: z.number().int() })),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

// ---- Sessão e conta -------------------------------------------------------

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({ user: userSchema, expiresAt: z.iso.datetime() })
export type Session = z.infer<typeof sessionSchema>

export const authResponseSchema = sessionSchema.extend({ token: z.string() })
export type AuthResponse = z.infer<typeof authResponseSchema>

export const loginBodySchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginBody = z.infer<typeof loginBodySchema>

export const signupBodySchema = z
  .object({
    username: z.string().trim().min(3, 'Use ao menos 3 caracteres'),
    email: z.email('Informe um e-mail válido'),
    password: z.string().min(8, 'Use ao menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type SignupBody = z.infer<typeof signupBodySchema>

// ---- Perfil --------------------------------------------------------------

export const profileBodySchema = z.object({
  displayName: z.string().trim().min(2, 'Use ao menos 2 caracteres').max(60, 'Use no máximo 60 caracteres'),
  username: z.string().trim().min(3, 'Use ao menos 3 caracteres').max(30, 'Use no máximo 30 caracteres'),
  email: z.email('Informe um e-mail válido'),
})
export type ProfileBody = z.infer<typeof profileBodySchema>

export const passwordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'Use ao menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type PasswordBody = z.infer<typeof passwordBodySchema>

/** Avatar já reduzido no cliente (JPEG/PNG/WebP em data URL). Limite de tamanho no servidor. */
export const AVATAR_MAX_CHARS = 300_000
export const avatarBodySchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Use uma imagem PNG, JPEG ou WebP')
    .max(AVATAR_MAX_CHARS, 'A imagem é grande demais'),
})

// ---- Carteiras -------------------------------------------------------------

export const MAX_WALLETS = 5

export const walletSchema = z.object({
  id: z.string(),
  network: networkSchema,
  address: z.string(),
  label: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime(),
})
export type Wallet = z.infer<typeof walletSchema>
export const walletListSchema = z.object({ items: z.array(walletSchema) })

export const addWalletBodySchema = z.object({
  network: networkSchema,
  label: z.string().trim().min(1, 'Dê um nome à carteira').max(30, 'Use no máximo 30 caracteres'),
})
export type AddWalletBody = z.infer<typeof addWalletBodySchema>

// ---- Newsletter -----------------------------------------------------------

export const newsletterBodySchema = z.object({ email: z.email('Informe um e-mail válido') })
export type NewsletterBody = z.infer<typeof newsletterBodySchema>

// ---- Favoritos ------------------------------------------------------------

export const favoritesResponseSchema = z.object({ nftIds: z.array(z.string()) })
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

// ---- Carrinho, cupom e cotação --------------------------------------------

export const cartItemSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  coupon: z.string().nullable(),
})
export type CartState = z.infer<typeof cartSchema>

export const cartItemBodySchema = z.object({
  nftId: z.string(),
  quantity: z.number().int().min(1),
})

export const couponCodeBodySchema = z.object({ code: z.string().trim().min(1, 'Informe o código') })

export const couponSchema = z.object({
  code: z.string(),
  description: z.string(),
  kind: z.enum(['percent', 'fixed']),
  value: z.string(),
})
export type Coupon = z.infer<typeof couponSchema>

export const quoteRequestSchema = z.object({
  items: z.array(cartItemSchema).max(50),
  coupon: z.string().nullable().optional(),
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

export const quoteLineStatusSchema = z.enum(['ok', 'exceeds_stock', 'sold_out'])

export const quoteLineSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  editionLabel: z.string(),
  unitPrice: ethString,
  quantity: z.number().int(),
  lineTotal: ethString,
  available: z.number().int().nonnegative(),
  status: quoteLineStatusSchema,
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const quoteIssueSchema = z.object({
  type: z.enum(['exceeds_stock', 'sold_out', 'unknown_item', 'coupon_invalid', 'coupon_expired']),
  editionId: z.string().optional(),
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteSchema = z.object({
  /** Identifica o conteúdo da cotação. Muda se preço, disponibilidade, cupom ou taxa mudarem. */
  fingerprint: z.string(),
  lines: z.array(quoteLineSchema),
  subtotal: ethString,
  discount: ethString,
  networkFee: ethString,
  total: ethString,
  coupon: z
    .object({
      code: z.string(),
      status: z.enum(['applied', 'invalid', 'expired']),
      description: z.string(),
    })
    .nullable(),
  issues: z.array(quoteIssueSchema),
  canCheckout: z.boolean(),
  generatedAt: z.iso.datetime(),
})
export type Quote = z.infer<typeof quoteSchema>

// ---- Carteira, checkout e pedidos -----------------------------------------

export const walletConnectBodySchema = z.object({ network: networkSchema })
export const walletConnectionSchema = z.object({ address: z.string(), network: networkSchema })
export type WalletConnection = z.infer<typeof walletConnectionSchema>

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

/** Cabeçalho obrigatório em POST /orders. Mesma chave + mesmo conteúdo = mesmo pedido. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

export const createOrderBodySchema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
  coupon: z.string().nullable().optional(),
  /** Cotação que o usuário viu e confirmou. Se mudou no servidor, o pedido é recusado com 409. */
  quoteFingerprint: z.string(),
  network: networkSchema,
  walletAddress: z.string().min(1),
})
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>

/** Motivos de 409 em POST /orders (campo `fields.reason`). */
export const ORDER_CONFLICT_REASONS = ['QUOTE_CHANGED', 'UNAVAILABLE', 'IDEMPOTENCY_MISMATCH'] as const

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  /** Cresce a cada mudança. Eventos com versão <= à conhecida são descartados. */
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  network: networkSchema,
  walletAddress: z.string(),
  /** Instantâneo no momento da compra: o recibo nunca muda com o catálogo. */
  quote: quoteSchema,
  declineReason: z.string().nullable(),
  txHash: z.string().nullable(),
})
export type Order = z.infer<typeof orderSchema>

export const orderListSchema = z.object({ items: z.array(orderSchema) })

export const ORDER_UPDATED = 'order.updated'

export const orderUpdatedEventSchema = z.object({
  eventId: z.string(),
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  version: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime(),
  data: z.object({
    status: orderStatusSchema,
    declineReason: z.string().nullable(),
    txHash: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

// ---- Erros ----------------------------------------------------------------

export const API_ERROR_CODES = [
  'VALIDATION_ERROR', // 422
  'UNAUTHENTICATED', // 401
  'SESSION_EXPIRED', // 401
  'FORBIDDEN', // 403
  'NOT_FOUND', // 404
  'CONFLICT', // 409 (cadastro, disponibilidade, idempotência)
  'TRANSIENT', // 503
] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
})

// ---- Eventos em tempo real ------------------------------------------------

export const nftUpdatedEventSchema = z.object({
  /** Identidade estável do evento: permite descartar duplicatas. */
  eventId: z.string(),
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  /** Versão do recurso. Eventos com versão <= à conhecida são descartados. */
  version: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime(),
  data: z.object({
    price: ethString,
    previousPrice: ethString.nullable(),
    editions: z.array(z.object({ id: z.string(), available: z.number().int().nonnegative() })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const NFT_UPDATED = 'nft.updated'

/**
 * Caminho do handshake do Socket.IO. Não usamos o padrão "/socket.io/" porque o MSW
 * remove esse prefixo ao casar handlers, o que tornaria o handler indistinguível do
 * WebSocket do HMR do Vite (ambos cairiam em "/").
 */
export const REALTIME_PATH = '/kurio-rt/'
