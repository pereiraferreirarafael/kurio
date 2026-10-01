import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart } from 'lucide-react'
import { useCart } from '@/api/cart'
import { logout, sessionQuery } from '@/api/session'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navBase = 'relative py-2 text-body-lg text-foreground hover:text-accent'
const activeStyle = 'font-bold text-accent after:absolute after:inset-x-0 after:-bottom-[3px] after:h-[2px] after:bg-accent'
/** Páginas próprias: o roteador marca .active. */
const navLink = `${navBase} [&.active]:font-bold [&.active]:text-accent [&.active]:after:absolute [&.active]:after:inset-x-0 [&.active]:after:-bottom-[3px] [&.active]:after:h-[2px] [&.active]:after:bg-accent`

const iconButton = 'grid size-8 place-items-center text-foreground hover:text-accent'

export function SiteHeader() {
  const { data: session } = useQuery(sessionQuery)
  const navigate = useNavigate()
  const location = useLocation()
  // Início e Mercado são a mesma rota (/) e se distinguem pela âncora #mercado.
  const onHome = location.pathname === '/'
  const onMarket = onHome && location.hash === 'mercado'
  const { itemCount } = useCart()
  const signOut = useMutation({
    mutationFn: logout,
    onSettled: () => navigate({ to: '/' }),
  })

  async function focusSearch() {
    await navigate({ to: '/', hash: 'mercado' })
    const field = document.getElementById('busca')
    field?.scrollIntoView({ block: 'center' })
    field?.focus()
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex min-h-[45px] max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-1 lg:flex-nowrap lg:py-0">
        <Link to="/" className="text-body font-bold tracking-widest text-foreground lg:w-40">
          KURIO
        </Link>
        <nav
          aria-label="Principal"
          className="order-last flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-0 lg:order-none lg:w-auto lg:justify-start lg:gap-10"
        >
          <Link to="/" hash={undefined} className={cn(navBase, onHome && !onMarket && activeStyle)} aria-current={onHome && !onMarket ? 'page' : undefined}>
            Início
          </Link>
          <Link to="/" hash="mercado" className={cn(navBase, onMarket && activeStyle)} aria-current={onMarket ? 'page' : undefined}>
            Mercado
          </Link>
          <Link to="/criadores" className={navLink}>
            Criadores
          </Link>
          <Link to="/aprenda" className={navLink}>
            Aprenda
          </Link>
          {session ? (
            <>
              <Link to="/profile" className={navLink}>
                Perfil
              </Link>
              <Link to="/wallets" className={navLink}>
                Carteiras
              </Link>
            </>
          ) : null}
        </nav>
        <div className="flex items-center gap-4 lg:gap-7">
          <button type="button" onClick={() => void focusSearch()} aria-label="Buscar NFTs" className={iconButton}>
            <Search className="size-5" aria-hidden="true" />
          </button>
          <Link to="/cart" aria-label={itemCount > 0 ? `Carrinho, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}` : 'Carrinho'} className={`${iconButton} relative`}>
            <ShoppingCart className="size-6" aria-hidden="true" />
            {itemCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-primary-foreground"
              >
                {itemCount}
              </span>
            ) : null}
          </Link>
          {session ? (
            <Button size="sm" variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
              Sair
            </Button>
          ) : (
            <Link to="/login" className={`${buttonVariants({ size: 'sm' })} gap-1 normal-case`}>
              <LogIn className="size-5" aria-hidden="true" />
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
