import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const box = 'grid size-[35px] place-items-center border text-body'

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end">
      <ul className="flex items-center gap-2">
        <li>
          {page > 1 ? (
            <Link from="/" to="/" search={(p) => ({ ...p, page: page - 1 })} aria-label="Página anterior" className={cn(box, 'border-border-strong')}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </li>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <Link
              from="/"
              to="/"
              search={(p) => ({ ...p, page: n })}
              aria-label={`Página ${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={cn(
                box,
                n === page ? 'border-primary bg-primary font-bold text-primary-foreground' : 'border-border-strong',
              )}
            >
              {n}
            </Link>
          </li>
        ))}
        <li>
          {page < totalPages ? (
            <Link from="/" to="/" search={(p) => ({ ...p, page: page + 1 })} aria-label="Próxima página" className={cn(box, 'border-border-strong')}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  )
}
