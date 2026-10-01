import type { Quote } from '@/api/contracts'
import { formatEth } from '@/lib/money'

/** Descreve o que mudou entre duas cotações, para avisar o usuário sem alteração silenciosa. */
export function describeQuoteChanges(previous: Quote, next: Quote): string[] {
  const messages: string[] = []
  for (const line of next.lines) {
    const before = previous.lines.find((l) => l.editionId === line.editionId)
    if (!before) continue
    if (before.unitPrice !== line.unitPrice) {
      messages.push(`${line.name}: preço mudou de ${formatEth(before.unitPrice)} para ${formatEth(line.unitPrice)}.`)
    }
    if (before.status === 'ok' && line.status === 'sold_out') {
      messages.push(`${line.name} (${line.editionLabel}) esgotou.`)
    } else if (before.status === 'ok' && line.status === 'exceeds_stock') {
      messages.push(`${line.name} (${line.editionLabel}): restam apenas ${line.available}. Ajuste a quantidade.`)
    }
  }
  if (previous.networkFee !== next.networkFee) {
    messages.push(`A taxa de rede mudou para ${formatEth(next.networkFee, { maxFractionDigits: 6 })}.`)
  }
  return messages
}
