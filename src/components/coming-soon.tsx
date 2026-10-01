/** Marcador de tela ainda não implementada. Não simula sucesso funcional. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <h1 className="text-heading font-bold">{title}</h1>
      <p className="mt-4 text-muted-foreground">Esta tela ainda não foi implementada nesta etapa.</p>
    </section>
  )
}
