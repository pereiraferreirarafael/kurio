import { type Page, expect } from '@playwright/test'

export const ANA = { email: 'ana@kurio.dev', password: 'Kurio@123' }
export const BRUNO = { email: 'bruno@kurio.dev', password: 'Kurio@456' }

declare global {
  interface Window {
    __kurioMock?: {
      setScenario(name: string): void
      emitNftUpdate(id: string, patch: object, options?: object): { eventId: string; version: number }
      emitOrderUpdate(id: string, options?: object): unknown
      settleOrder(id: string, outcome?: 'confirm' | 'decline'): unknown
      connectedClients(): number
    }
  }
}

/** Troca o cenário do mock no navegador (persistido em localStorage, vale para as próximas chamadas). */
export async function mockReady(page: Page) {
  await page.waitForFunction(() => Boolean(window.__kurioMock))
}

export async function setScenario(page: Page, name: string) {
  await mockReady(page)
  await page.evaluate((n) => window.__kurioMock!.setScenario(n), name)
}

export async function login(page: Page, user = ANA, redirect?: string) {
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).last().click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

/** Garante estoque suficiente (determinístico) e devolve ao catálogo. Usa o mesmo canal do socket. */
export async function setStock(page: Page, nftId: string, editionId: string, available: number) {
  await mockReady(page)
  await page.evaluate(([id, e, n]) => window.__kurioMock!.emitNftUpdate(id as string, { availability: { [e as string]: n } }), [nftId, editionId, available])
}

/** Espera a conexão Socket.IO (real) estar aberta no mock. */
export async function waitRealtime(page: Page) {
  await mockReady(page)
  await expect.poll(() => page.evaluate(() => window.__kurioMock!.connectedClients())).toBeGreaterThan(0)
}

export async function addToCartFromDetail(page: Page, nftId: string, goToCart = true) {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: goToCart ? 'Comprar' : 'Adicionar ao carrinho' }).click()
  if (goToCart) await expect(page).toHaveURL(/\/cart$/)
}

export async function payFromCart(page: Page) {
  await page.getByRole('button', { name: 'Finalizar compra' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada:')).toBeVisible()
  await page.getByRole('button', { name: /Confirmar pagamento|Confirmar novos valores/ }).click()
}
