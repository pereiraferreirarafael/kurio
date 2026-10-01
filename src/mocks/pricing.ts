import type { CartItem, Coupon, Nft, Quote, QuoteIssue, QuoteLine } from '@/api/contracts'
import { type EthString, minEth, mulEth, pctOfEth, subEth, sumEth } from '@/lib/money'

export const NETWORK_FEE: EthString = '0.016'

interface CouponDef extends Coupon {
  expired?: boolean
}

const COUPONS: CouponDef[] = [
  { code: 'KURIO10', description: '10% de desconto', kind: 'percent', value: '10' },
  { code: 'LANCAMENTO', description: 'Desconto do lançamento', kind: 'fixed', value: '0.5' },
  { code: 'EXPIRADO20', description: '20% de desconto', kind: 'percent', value: '20', expired: true },
]

export type CouponResolution =
  | { status: 'applied'; coupon: Coupon }
  | { status: 'expired'; coupon: Coupon }
  | { status: 'invalid' }

export function resolveCoupon(code: string): CouponResolution {
  const def = COUPONS.find((c) => c.code === code.trim().toUpperCase())
  if (!def) return { status: 'invalid' }
  const { expired, ...coupon } = def
  return { status: expired ? 'expired' : 'applied', coupon }
}

/** Hash FNV-1a (32 bits). Não é criptográfico: serve só para detectar mudança de cotação. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Cotação calculada no "servidor". Fonte única de valores para carrinho, checkout e recibo.
 * Toda a aritmética é decimal (strings ETH); quantidades são inteiras.
 */
export function buildQuote(nfts: Nft[], items: CartItem[], couponCode: string | null | undefined): Quote {
  const issues: QuoteIssue[] = []
  const lines: QuoteLine[] = []

  for (const item of items) {
    const nft = nfts.find((n) => n.id === item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) {
      issues.push({ type: 'unknown_item', editionId: item.editionId, message: 'Um item do carrinho não existe mais.' })
      continue
    }
    const status: QuoteLine['status'] =
      edition.available === 0 ? 'sold_out' : item.quantity > edition.available ? 'exceeds_stock' : 'ok'
    if (status === 'sold_out') {
      issues.push({ type: 'sold_out', editionId: edition.id, message: `${nft.name} (${edition.label}) está esgotado.` })
    } else if (status === 'exceeds_stock') {
      issues.push({
        type: 'exceeds_stock',
        editionId: edition.id,
        message: `${nft.name} (${edition.label}) tem apenas ${edition.available} disponível(is).`,
      })
    }
    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      editionLabel: edition.label,
      unitPrice: nft.price,
      quantity: item.quantity,
      lineTotal: mulEth(nft.price, item.quantity),
      available: edition.available,
      status,
    })
  }

  const subtotal = sumEth(lines.map((l) => l.lineTotal))

  let discount: EthString = '0'
  let coupon: Quote['coupon'] = null
  if (couponCode) {
    const resolved = resolveCoupon(couponCode)
    if (resolved.status === 'invalid') {
      coupon = { code: couponCode, status: 'invalid', description: 'Cupom inválido' }
      issues.push({ type: 'coupon_invalid', message: 'O cupom aplicado não é válido.' })
    } else {
      coupon = { code: resolved.coupon.code, status: resolved.status, description: resolved.coupon.description }
      if (resolved.status === 'expired') {
        issues.push({ type: 'coupon_expired', message: `O cupom ${resolved.coupon.code} expirou.` })
      } else {
        discount =
          resolved.coupon.kind === 'percent'
            ? pctOfEth(subtotal, resolved.coupon.value)
            : minEth(resolved.coupon.value, subtotal)
      }
    }
  }

  const total = lines.length > 0 ? sumEth([subEth(subtotal, discount), NETWORK_FEE]) : '0'
  const fingerprint = fnv1a(
    JSON.stringify([lines.map((l) => [l.editionId, l.quantity, l.unitPrice, l.available]), discount, NETWORK_FEE, coupon?.status]),
  )

  return {
    fingerprint,
    lines,
    subtotal,
    discount,
    networkFee: lines.length > 0 ? NETWORK_FEE : '0',
    total,
    coupon,
    issues,
    canCheckout: lines.length > 0 && issues.length === 0,
    generatedAt: new Date().toISOString(),
  }
}
