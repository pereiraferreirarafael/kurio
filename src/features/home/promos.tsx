import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

const PROMOS = [
  {
    art: '/nfts/art-0.webp',
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    hash: 'mercado',
  },
  {
    art: '/nfts/art-2.webp',
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    hash: 'mercado',
  },
] as const

export function Promos() {
  return (
    <section aria-label="Promoções" className="grid gap-6 lg:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title[0]} className="relative flex min-h-[250px] overflow-hidden rounded-lg bg-card">
          <img src={p.art} alt="" width={292} height={250} loading="lazy" className="hidden w-[292px] shrink-0 rounded-[18px] object-cover sm:block" />
          <div className="flex flex-1 flex-col items-end justify-between gap-4 p-6 text-right sm:py-9 sm:pl-6 sm:pr-8">
            <div className="flex flex-col items-end gap-4">
              <h2 className="text-[18px] font-bold leading-6">
                {p.title[0]}
                <br />
                {p.title[1]}
              </h2>
              <p className="max-w-[263px] text-body leading-6 text-muted-foreground">{p.text}</p>
            </div>
            <Link
              to="/"
              hash={p.hash}
              className="inline-flex h-10 w-[140px] items-center justify-center gap-1 rounded-md bg-primary text-body font-medium text-primary-foreground hover:bg-accent"
            >
              Explorar
              <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}
