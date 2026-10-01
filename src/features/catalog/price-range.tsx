import { useEffect, useState } from 'react'
import type { NftListParams } from '@/api/contracts'

/** Limites do controle. O catálogo simulado vai de ~0,2 a ~10 ETH. */
export const PRICE_MIN = 0
export const PRICE_MAX = 10
const STEP = 0.01

const fmt = (n: number) => n.toFixed(2).replace('.', ',')
const toParam = (n: number) => String(Number(n.toFixed(2)))

interface PriceRangeProps {
  search: NftListParams
  onApply: (range: { minPrice?: string; maxPrice?: string }) => void
}

/** Dois campos range sobrepostos. O filtro só vai para a URL ao clicar em Aplicar. */
export function PriceRange({ search, onApply }: PriceRangeProps) {
  const appliedMin = search.minPrice ? Number(search.minPrice) : PRICE_MIN
  const appliedMax = search.maxPrice ? Number(search.maxPrice) : PRICE_MAX
  const [min, setMin] = useState(appliedMin)
  const [max, setMax] = useState(appliedMax)

  // A URL manda: voltar/avançar no histórico ou limpar filtros reposiciona os controles.
  useEffect(() => {
    setMin(appliedMin)
    setMax(appliedMax)
  }, [appliedMin, appliedMax])

  const span = PRICE_MAX - PRICE_MIN
  const left = ((min - PRICE_MIN) / span) * 100
  const right = ((max - PRICE_MIN) / span) * 100

  return (
    <div className="flex flex-col gap-3 pl-3">
      <div className="relative h-6">
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-border-strong" />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-primary"
          style={{ left: `${left}%`, width: `${Math.max(right - left, 0)}%` }}
        />
        <input
          type="range"
          aria-label="Preço mínimo"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={STEP}
          value={min}
          onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
          className="price-thumb absolute inset-0"
        />
        <input
          type="range"
          aria-label="Preço máximo"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={STEP}
          value={max}
          onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
          className="price-thumb absolute inset-0"
        />
      </div>
      <p aria-live="polite" className="text-[15px]">
        Preço: {fmt(min)} - {fmt(max)} ETH
      </p>
      <button
        type="button"
        onClick={() =>
          onApply({
            minPrice: min <= PRICE_MIN ? undefined : toParam(min),
            maxPrice: max >= PRICE_MAX ? undefined : toParam(max),
          })
        }
        className="self-start rounded-md bg-primary px-3 py-2 text-body-lg font-bold leading-5 text-primary-foreground hover:bg-accent"
      >
        Aplicar
      </button>
    </div>
  )
}
