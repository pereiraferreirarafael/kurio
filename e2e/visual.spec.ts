import { expect, test } from '@playwright/test'
import { addToCartFromDetail, login } from './helpers'
import type { Page } from '@playwright/test'

/** Deixa a página estável para o screenshot: fontes de todos os pesos e imagens (inclusive as preguiçosas) carregadas. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      ['400', '500', '700'].map((w) => document.fonts.load(`${w} 14px "Roboto Mono"`)),
    )
    await document.fonts.ready
    const images = Array.from(document.images)
    images.forEach((img) => {
      img.loading = 'eager'
    })
    await Promise.all(images.map((img) => (img.complete ? undefined : new Promise((r) => { img.onload = img.onerror = () => r(undefined) }))))
  })
}


// Regressão visual: baselines por projeto (desktop/mobile) em e2e/__screenshots__.
// Gere/atualize com: npx playwright test visual --update-snapshots
test.describe('regressão visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({ content: '*{caret-color:transparent!important}' }).catch(() => {})
  })

  test('home', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('li:has(a[href^="/nft/"])').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('home.png', { fullPage: true })
  })

  test('detalhe do NFT', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { name: /Emerald Ape #042/ })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('login.png', { fullPage: true })
  })

  test('cadastro', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('cadastro.png', { fullPage: true })
  })

  test('carrinho', async ({ page }) => {
    await addToCartFromDetail(page, 'emerald-ape-042', true)
    await expect(page.getByRole('complementary').getByText('1.206 ETH')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', true)
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByRole('complementary').getByText('1.206 ETH')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })

  test('perfil e carteiras', async ({ page }) => {
    await login(page)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('perfil.png', { fullPage: true })
    await page.goto('/wallets')
    await expect(page.getByText('Você ainda não tem carteiras')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('carteiras.png', { fullPage: true })
  })
})
