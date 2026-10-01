import { Minus, Plus } from 'lucide-react'

interface Props {
  label: string
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}

/** Controle de quantidade acessível: botões rotulados e valor anunciado. */
export function QuantityStepper({ label, value, min = 1, max, onChange, disabled }: Props) {
  const btn =
    'grid size-8 place-items-center border border-border-strong hover:bg-card disabled:opacity-40 disabled:pointer-events-none'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <button type="button" className={btn} aria-label={`Diminuir ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-body font-bold">
        {value}
      </output>
      <button type="button" className={btn} aria-label={`Aumentar ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
