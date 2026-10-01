import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Arte de cada slide. Troque os arquivos em public/nfts/ para usar as artes finais do Figma. */
const SLIDES = [
  { src: '/nfts/art-0.webp', alt: 'Arte em destaque: Emerald Ape' },
  { src: '/nfts/art-2.webp', alt: 'Arte em destaque: Ivory Baron' },
  { src: '/nfts/art-1.webp', alt: 'Arte em destaque: Violet Nomad' },
] as const

export function Hero() {
  const [active, setActive] = useState(0)
  const slide = SLIDES[active]!

  return (
    <section aria-labelledby="titulo-hero" className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_85%_40%,rgba(210,138,76,0.12),transparent)]"
      />
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-8 px-6 py-8 md:min-h-[450px] md:flex-row md:items-center md:py-0 md:pl-10 md:pr-5">
        <div className="flex w-full flex-col gap-8 md:max-w-[600px] md:gap-11">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex flex-col gap-2">
                <p className="text-body font-medium leading-4 tracking-[1.4px]">Bem-vindo à Kurio</p>
                <h1 id="titulo-hero" className="text-[28px] font-bold leading-[1.3] sm:text-4xl md:text-[43px] md:leading-[70px]">
                  SEJA DONO DO FUTURO <br className="hidden md:block" />
                  DA ARTE DIGITAL
                </h1>
              </div>
              <p className="max-w-[557px] text-body leading-6 text-muted-foreground">
                Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
                artistas e tenha uma parte da cultura da internet.
              </p>
            </div>
            <Link
              to="/"
              hash="mercado"
              className="inline-flex h-10 w-[140px] items-center justify-center rounded-md bg-primary px-4 text-body-lg font-bold text-primary-foreground hover:bg-accent"
            >
              EXPLORAR
            </Link>
          </div>
          <div role="tablist" aria-label="Destaques" className="flex gap-2">
            {SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Destaque ${i + 1} de ${SLIDES.length}`}
                onClick={() => setActive(i)}
                className="grid size-6 place-items-center"
              >
                <span className={cn('size-2 rounded-full bg-primary', i === active ? 'opacity-100' : 'opacity-50')} />
              </button>
            ))}
          </div>
        </div>
        <img
          src={slide.src}
          alt={slide.alt}
          width={450}
          height={450}
          fetchPriority="high"
          className="hidden aspect-square w-full max-w-[450px] shrink-0 self-center rounded-3xl object-cover md:block"
        />
      </div>
    </section>
  )
}
