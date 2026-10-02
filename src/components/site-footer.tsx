import { Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useSubscribeNewsletter } from '@/api/account'
import { toApiError } from '@/api/client'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
] as const

const SOCIAL = [
  { label: 'Facebook', glyph: 'f', href: 'https://www.facebook.com' },
  { label: 'Instagram', glyph: 'I', href: 'https://www.instagram.com' },
  { label: 'X (Twitter)', glyph: 'x', href: 'https://x.com' },
  { label: 'LinkedIn', glyph: 'in', href: 'https://www.linkedin.com' },
  { label: 'YouTube', glyph: 'Y', href: 'https://www.youtube.com' },
] as const

const listItem = 'leading-[30px]'
const colTitle = 'text-[18px] font-bold leading-4'

function Newsletter() {
  const [email, setEmail] = useState('')
  const subscribe = useSubscribeNewsletter()
  const error = subscribe.isError ? toApiError(subscribe.error) : null

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    subscribe.mutate({ email: email.trim() }, { onSuccess: () => setEmail('') })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 px-4 lg:w-[357px]">
      <label htmlFor="newsletter-email" className="text-[18px] font-bold leading-5">
        Antecipe-se ao próximo lançamento
      </label>
      <div className="flex h-10 overflow-hidden rounded-md bg-surface shadow-[0_0_10px_rgba(10,6,4,0.45)]">
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={error ? true : undefined}
          aria-describedby="newsletter-status"
          className="min-w-0 flex-1 bg-transparent px-3 text-body placeholder:text-secondary"
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="w-[85px] bg-primary text-[18px] font-bold text-primary-foreground hover:bg-accent disabled:opacity-60"
        >
          Enviar
        </button>
      </div>
      <p id="newsletter-status" role="status" className="min-h-5 text-caption">
        {subscribe.isSuccess ? (
          <span className="text-success">Inscrição confirmada. Você receberá os próximos lançamentos.</span>
        ) : error ? (
          <span className="text-destructive">{error.fields.email ?? error.message}</span>
        ) : null}
      </p>
      <p className="text-[13px] leading-[22px] text-muted-foreground">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
    </form>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-24">
      <div className="bg-card p-8">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[1fr_1px_1fr_1px_1fr_1px_auto]">
          {FEATURES.map((f, i) => (
            <div key={f.letter} className="contents">
              {i > 0 ? <div aria-hidden="true" className="hidden bg-primary lg:block" /> : null}
              <section className="flex flex-col gap-3 px-4">
                <div className="grid size-[74px] place-items-center rounded-full bg-primary text-[24px] font-bold text-primary-foreground" aria-hidden="true">
                  {f.letter}
                </div>
                <h2 className="text-[17px] font-bold leading-5">{f.title}</h2>
                <p className="max-w-[204px] text-body leading-[22px] text-muted-foreground">{f.text}</p>
              </section>
            </div>
          ))}
          <div aria-hidden="true" className="hidden bg-primary lg:block" />
          <Newsletter />
        </div>
      </div>

      <div className="bg-surface p-8">
        <div className="mx-auto grid max-w-[1200px] items-center gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[92px]">
          <p className="text-body font-bold tracking-[1.4px]">KURIO</p>
          <p className="text-body leading-[22px]">
            Feito para colecionadores,
            <br />
            criadores e cultura
          </p>
          <a href="mailto:contato@kurio.dev" className="text-body hover:text-accent">
            contato@kurio.dev
          </a>
          <p className="text-body">+55 11 4002 8922</p>
        </div>
      </div>

      <div className="bg-card p-8">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_228px] lg:gap-[124px]">
          <nav aria-label="Conta" className="flex flex-col gap-2">
            <h2 className={colTitle}>Meu perfil</h2>
            <ul className="text-body">
              <li className={listItem}>
                <Link to="/profile" className="hover:text-accent">
                  Meu perfil
                </Link>
              </li>
              <li className={listItem}>
                <Link to="/wallets" className="hover:text-accent">
                  Carteiras
                </Link>
              </li>
              <li className={listItem}>
                <Link to="/cart" className="hover:text-accent">
                  Carrinho
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Ajuda" className="flex flex-col gap-2">
            <h2 className={colTitle}>Central de ajuda</h2>
            <ul className="text-body">
              <li className={listItem}>
                <Link to="/aprenda" className="hover:text-accent">
                  Como comprar NFTs
                </Link>
              </li>
              <li className={listItem}>
                <Link to="/aprenda" className="hover:text-accent">
                  Carteira e segurança
                </Link>
              </li>
              <li className={listItem}>
                <Link to="/criadores" className="hover:text-accent">
                  Criadores
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Coleções" className="flex flex-col gap-2">
            <h2 className={colTitle}>Coleções</h2>
            <ul className="text-body">
              {[
                ['Kurio Apes', 'kurio-apes'],
                ['Kurio Editions', 'kurio-editions'],
                ['Neon Vessels', 'neon-vessels'],
              ].map(([name, slug]) => (
                <li key={slug} className={listItem}>
                  <Link to="/" search={{ collection: slug }} hash="mercado" className="hover:text-accent">
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-5">
              <h2 className={colTitle}>Redes sociais</h2>
              <ul className="flex gap-[10px]">
                {SOCIAL.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="grid size-[30px] place-items-center rounded-md border border-primary text-caption font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <span aria-hidden="true">{s.glyph}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className={colTitle}>Carteiras compatíveis</h2>
              <p className="rounded-md border border-border-strong bg-surface px-2 py-2 text-[9px] font-bold tracking-[0.1px] text-accent">
                METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="bg-background py-1 text-center text-body leading-[30px]">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
