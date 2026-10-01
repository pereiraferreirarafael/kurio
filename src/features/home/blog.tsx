const POSTS = [
  {
    art: '/nfts/art-2.webp',
    meta: '12 de setembro  |  Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
  },
  {
    art: '/nfts/art-0.webp',
    meta: '13 de setembro  |  Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
  },
  {
    art: '/nfts/art-1.webp',
    meta: '15 de setembro  |  Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
  },
  {
    art: '/nfts/art-3.webp',
    meta: '15 de setembro  |  Leitura de 2 min',
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
  },
] as const

/** Conteúdo editorial estático: não há back-end de blog neste desafio. */
export function Blog() {
  return (
    <section aria-labelledby="titulo-blog" className="flex flex-col gap-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h2 id="titulo-blog" className="text-[28px] font-bold">
          Diário da Cunhagem
        </h2>
        <p className="text-body text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title} className="flex flex-col overflow-hidden rounded-lg bg-card">
            <img src={post.art} alt="" width={268} height={195} loading="lazy" className="h-[195px] w-full object-cover" />
            <div className="flex flex-col gap-2 px-4 pb-4 pt-3">
              <p className="text-caption font-medium leading-4 text-muted-foreground">{post.meta}</p>
              <h3 className="text-body-lg font-bold">{post.title}</h3>
              <p className="text-caption font-medium leading-4 text-muted-foreground">{post.text}</p>
              <p className="flex gap-1 text-caption text-accent">
                <span className="font-bold">Ler mais</span>
                <span aria-hidden="true">→</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
