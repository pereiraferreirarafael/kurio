import { describe, expect, it } from 'vitest'
import { compareEth, formatEth, isEthString, minEth, mulEth, pctOfEth, subEth, sumEth } from './money'

describe('money', () => {
  it('mantém precisão decimal (0.1 + 0.2)', () => {
    expect(sumEth(['0.1', '0.2'])).toBe('0.3')
  })

  it('reproduz os totais do carrinho do Figma', () => {
    const items = [mulEth('1.19', 2), mulEth('1.39', 6), mulEth('1.79', 9)]
    expect(items).toEqual(['2.38', '8.34', '16.11'])
    const subtotal = sumEth(items)
    expect(subtotal).toBe('26.83')
    expect(sumEth([subtotal, '0.016'])).toBe('26.846')
  })

  it('formata como no layout', () => {
    expect(formatEth('1.1')).toBe('1.10 ETH')
    expect(formatEth('26.846')).toBe('26.846 ETH')
    expect(formatEth('0.016')).toBe('0.016 ETH')
  })

  it('valida strings e quantidades', () => {
    expect(isEthString('1.5')).toBe(true)
    expect(isEthString('1e3')).toBe(false)
    expect(() => mulEth('1', 1.5)).toThrow(RangeError)
    expect(compareEth('1.10', '1.1')).toBe(0)
  })

  it('calcula desconto percentual e fixo sem ponto flutuante', () => {
    expect(pctOfEth('26.83', '10')).toBe('2.683')
    expect(subEth('26.83', pctOfEth('26.83', '10'))).toBe('24.147')
    expect(minEth('0.5', '0.39')).toBe('0.39')
    expect(pctOfEth('0.1', '33.333')).toBe('0.033333')
  })
})
