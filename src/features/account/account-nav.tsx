import { Link } from '@tanstack/react-router'

const tab =
  'border-b-2 border-transparent px-1 py-2 text-body text-muted-foreground hover:text-foreground [&.active]:border-accent [&.active]:text-accent'

export function AccountNav() {
  return (
    <nav aria-label="Conta" className="mb-8 flex gap-6 border-b border-border">
      <Link to="/profile" className={tab}>
        Perfil
      </Link>
      <Link to="/wallets" className={tab}>
        Carteiras
      </Link>
    </nav>
  )
}
