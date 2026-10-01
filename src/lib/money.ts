import Decimal from 'decimal.js'

// Valores em ETH trafegam como strings decimais. Nunca como number.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export type EthString = string

const ETH_RE = /^\d+(\.\d{1,18})?$/

export function isEthString(value: string): value is EthString {
  return ETH_RE.test(value)
}

export function eth(value: EthString): Decimal {
  if (!isEthString(value)) throw new RangeError(`Valor ETH inválido: ${value}`)
  return new Decimal(value)
}

export function assertQuantity(qty: number): number {
  if (!Number.isInteger(qty) || qty < 0) throw new RangeError(`Quantidade inválida: ${qty}`)
  return qty
}

export function toEthString(value: Decimal): EthString {
  return value.toFixed()
}

export function sumEth(values: EthString[]): EthString {
  return toEthString(values.reduce((acc, v) => acc.plus(eth(v)), new Decimal(0)))
}

export function mulEth(price: EthString, qty: number): EthString {
  return toEthString(eth(price).times(assertQuantity(qty)))
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  return eth(a).comparedTo(eth(b)) as -1 | 0 | 1
}

/** Formata como no layout: "1.19 ETH", "26.846 ETH", "0.016 ETH". */
export function formatEth(
  value: EthString,
  { minFractionDigits = 2, maxFractionDigits = 6 } = {},
): string {
  const fixed = eth(value).toDecimalPlaces(maxFractionDigits).toFixed(maxFractionDigits)
  const [int = '0', frac = ''] = fixed.split('.')
  const trimmed = frac.replace(/0+$/, '').padEnd(minFractionDigits, '0')
  return `${int}.${trimmed} ETH`
}

export function subEth(a: EthString, b: EthString): EthString {
  return toEthString(eth(a).minus(eth(b)))
}

export function minEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) <= 0 ? a : b
}

/** Percentual de um valor em ETH ("10" = 10%), arredondado a 18 casas (precisão do wei). */
export function pctOfEth(amount: EthString, percent: string): EthString {
  return toEthString(eth(amount).times(new Decimal(percent)).div(100).toDecimalPlaces(18))
}

/** Endereço abreviado para exibição: 0x1234…abcd. */
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
