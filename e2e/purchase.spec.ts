import { expect, test } from '@playwright/test'
import { ANA, BRUNO, addToCartFromDetail, login, payFromCart, setScenario, setStock, waitRealtime } from './helpers'

const EMERALD_E3 = 'emerald-ape-042-e3'

test.describe('carrinho', () => {
  test('visitante monta o carrinho, vê os totais do Figma e o carrinho sobrevive ao reload', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await setStock(page, 'emerald-ape-042', EMERALD_E3, 20)
    await page.getByLabel('1/50', { exact: false }).check({ force: true })
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await page.goto('/cart')
    const summary = page.getByRole('complementary')
    await expect(summary.getByText('2.38 ETH').first()).toBeVisible()
    await expect(summary.getByText('0.016 ETH')).toBeVisible()
    await expect(summary.getByText('2.396 ETH')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('complementary').getByText('2.396 ETH')).toBeVisible()
  })

  test('cupom válido recalcula; inválido e expirado mostram erro', async ({ page }) => {
    await addToCartFromDetail(page, 'emerald-ape-042', true)
    const summary = page.getByRole('complementary')
    await summary.getByLabel('Código promocional').fill('NAOEXISTE')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByText('Cupom inválido.')).toBeVisible()
    await summary.getByLabel('Código promocional').fill('EXPIRADO20')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByText('Este cupom expirou.')).toBeVisible()
    await summary.getByLabel('Código promocional').fill('KURIO10')
    await summary.getByRole('button', { name: 'Aplicar' }).click()
    await expect(summary.getByText('(-) 0.119 ETH')).toBeVisible()
    await expect(summary.getByText('1.087 ETH')).toBeVisible()
    await summary.getByRole('button', { name: 'Remover' }).click()
    await expect(summary.getByLabel('Código promocional')).toBeVisible()
  })

  test('mudança de preço em tempo real é avisada no carrinho', async ({ page }) => {
    await addToCartFromDetail(page, 'emerald-ape-042', true)
    await waitRealtime(page)
    // Só há o que comparar depois de o usuário ter visto a primeira cotação.
    await expect(page.getByRole('complementary').getByText('1.206 ETH')).toBeVisible()
    await page.evaluate(() => window.__kurioMock!.emitNftUpdate('emerald-ape-042', { price: '1.50' }))
    await expect(page.getByText('preço mudou de 1.19 ETH para 1.50 ETH')).toBeVisible()
    await expect(page.getByRole('complementary').getByText('1.516 ETH')).toBeVisible()
  })

  test('item que esgota bloqueia a finalização até ser removido', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'emerald-ape-042', true)
    await waitRealtime(page)
    await page.evaluate(() =>
      window.__kurioMock!.emitNftUpdate('emerald-ape-042', {
        availability: { 'emerald-ape-042-e1': 0, 'emerald-ape-042-e2': 0, 'emerald-ape-042-e3': 0 },
      }),
    )
    await expect(page.getByText(/esgotou|Esgotado/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Finalizar compra' })).toBeDisabled()
    await page.getByRole('button', { name: /Remover Emerald Ape/ }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('carrinho de visitante é mesclado ao entrar e exige login para finalizar', async ({ page }) => {
    await addToCartFromDetail(page, 'emerald-ape-042', true)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha').fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByText(/Emerald Ape #042/)).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('kurio.cart.guest'))).toBeNull()
  })

  test('falha ao escrever no carrinho desfaz a alteração e avisa', async ({ page }) => {
    await login(page)
    await page.goto('/nft/emerald-ape-042')
    await setStock(page, 'emerald-ape-042', 'emerald-ape-042-e1', 10)
    await page.getByRole('button', { name: 'Comprar' }).click()
    await expect(page.getByRole('complementary').getByText('1.206 ETH')).toBeVisible()
    await setScenario(page, 'cart-fail')
    await page.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'carrinho' })).toBeVisible()
    await expect(page.getByRole('complementary').getByText('1.206 ETH')).toBeVisible()
  })
})

test.describe('checkout e pedido', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('compra confirmada só pela resposta da simulação, via Socket.IO', async ({ page }) => {
    await addToCartFromDetail(page, 'golden-beat-207')
    await waitRealtime(page)
    await payFromCart(page)
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByRole('heading', { name: /Compra confirmada|Aguardando confirmação/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/^0x[0-9a-f]{64}$/)).toBeVisible()
    // Só o comprado saiu do carrinho
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('order-stall: fica pendente até a simulação decidir', async ({ page }) => {
    await setScenario(page, 'order-stall')
    await addToCartFromDetail(page, 'golden-beat-207')
    await waitRealtime(page)
    await payFromCart(page)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    await page.waitForTimeout(2500)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    const id = page.url().split('/').pop()!
    await page.evaluate((orderId) => window.__kurioMock!.settleOrder(orderId, 'confirm'), id)
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
  })

  test('pagamento recusado mantém o carrinho e permite tentar de novo', async ({ page }) => {
    await setScenario(page, 'order-declined')
    await addToCartFromDetail(page, 'golden-beat-207')
    await payFromCart(page)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('link', { name: 'Tentar novamente' })).toBeVisible()
    await page.goto('/cart')
    await expect(page.getByText(/Golden Beat #207/)).toBeVisible()
  })

  test('timeout depois da criação: tentar de novo recupera o mesmo pedido, sem duplicar', async ({ page }) => {
    await setScenario(page, 'order-timeout-after-create')
    await addToCartFromDetail(page, 'golden-beat-207')
    await payFromCart(page)
    await expect(page.getByText(/Não conseguimos confirmar se o pedido foi criado/)).toBeVisible({ timeout: 15_000 })
    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders.length)
    expect(orders).toBe(1)
  })

  test('falha ao criar o pedido não cria nada e permite repetir', async ({ page }) => {
    await setScenario(page, 'order-create-fails')
    await addToCartFromDetail(page, 'golden-beat-207')
    await payFromCart(page)
    await expect(page.getByRole('alert').filter({ hasText: /pedido|confirmar/i })).toBeVisible({ timeout: 15_000 })
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders.length)
    expect(orders).toBe(0)
  })

  test('carteira recusada mostra erro e permite reconectar', async ({ page }) => {
    await setScenario(page, 'wallet-refused')
    await addToCartFromDetail(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText('A carteira recusou a conexão.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Confirmar pagamento/ })).toBeDisabled()
    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText('Conectada:')).toBeVisible()
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByRole('button', { name: 'Conectar carteira' })).toBeVisible()
  })

  test('pedido é privado: outro usuário recebe não encontrado', async ({ page, context }) => {
    await addToCartFromDetail(page, 'golden-beat-207')
    await payFromCart(page)
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const url = page.url()
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await login(page, BRUNO)
    await page.goto(url)
    await expect(page.getByText('Este pedido não existe.')).toBeVisible()
    void context
  })
})
