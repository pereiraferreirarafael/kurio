import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'

export function NotFound({ message = 'Não encontramos esta página.' }: { message?: string }) {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-heading font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">{message}</p>
      <Link to="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </section>
  )
}
