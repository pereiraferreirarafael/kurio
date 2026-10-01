import { Link, useNavigate } from '@tanstack/react-router'
import type { NftListParams } from '@/api/contracts'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
] as const

const SORTS = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price_asc', label: 'Menor preço' },
  { id: 'price_desc', label: 'Maior preço' },
  { id: 'name', label: 'Nome (A–Z)' },
] as const

export function Toolbar({ search }: { search: NftListParams }) {
  const navigate = useNavigate({ from: '/' })
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
      <nav aria-label="Categorias">
        <ul className="flex gap-5">
          {TABS.map((tab) => (
            <li key={tab.id}>
              <Link
                from="/"
                to="/"
                search={(prev) => ({ ...prev, tab: tab.id, page: 1 })}
                aria-current={search.tab === tab.id ? 'page' : undefined}
                className={cn(
                  'pb-3 text-body',
                  search.tab === tab.id
                    ? 'border-b-2 border-accent font-bold text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-2 text-body">
        <label htmlFor="ordenar" className="text-muted-foreground">
          Ordenar por:
        </label>
        <select
          id="ordenar"
          value={search.sort}
          onChange={(e) =>
            void navigate({
              search: (prev) => ({ ...prev, sort: e.target.value as NftListParams['sort'], page: 1 }),
            })
          }
          className="h-9 border border-border-strong bg-card px-2 text-body"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
