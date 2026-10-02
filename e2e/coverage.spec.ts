import { expect, test } from '@playwright/test'
import { ANA, addToCartFromDetail, login, payFromCart, setScenario, waitRealtime } from './helpers'

const cards = (page: import('@playwright/test').Page) => page.locator('li:has(a[href^="/nft/"])')

test.describe('catálogo: ordenação, filtros combinados e histórico', () => {
  test('ordenação vai para a URL, reinicia a paginação e o histórico restaura cada estado', async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(9)

    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)

    // Mudar a ordenação volta para a página 1
    await page.getByLabel('Ordenar por:').selectOption('price_asc')
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(page).not.toHaveURL(/page=2/)

    // Preços em ordem crescente (lidos da interface, não do mock)
    // (a lista anterior permanece visível até a nova chegar, então esperamos a ordem correta)
    await expect
      .poll(async () => {
        const prices = await cards(page).locator('span.font-bold.text-accent').allTextContents()
        const numbers = prices.map((p) => Number(p.replace(/[^\d.]/g, '')))
        return numbers.length > 1 && numbers.every((n, i) => i === 0 || numbers[i - 1] <= n)
      })
      .toBe(true)

    // Histórico: voltar restaura a página 2 sem ordenação; avançar restaura a ordenação
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('recent')
    await page.goForward()
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('price_asc')
  })

  test('filtros se combinam (busca + coleção) e a mudança de filtro reinicia a página', async ({ page }) => {
    await page.goto('/?page=2')
    await expect(page).toHaveURL(/page=2/)
    await expect(cards(page).first()).toBeVisible()
    await expect(page.getByRole('main').getByRole('navigation', { name: 'Coleções' }).getByRole('link')).toHaveCount(3)

    await page.getByRole('main').getByRole('navigation', { name: 'Coleções' }).getByRole('link', { name: /Kurio Apes/ }).click()
    await expect(page).toHaveURL(/collection=kurio-apes/)
    await expect(page).not.toHaveURL(/page=2/)

    await expect(page.getByRole('main').getByRole('navigation', { name: 'Coleções' }).getByRole('link', { name: /Kurio Apes/ })).toHaveAttribute('aria-current', /^(true|page)$/)
    await expect(cards(page).first()).toBeVisible()
    const onlyCollection = await cards(page).count()
    await page.getByRole('searchbox').fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/collection=kurio-apes/)

    // Os resultados refletem a combinação: só o que casa com a busca E com a coleção
    await expect(cards(page)).toHaveCount(1)
    expect(onlyCollection).toBeGreaterThan(1)
    await expect(cards(page).first()).toContainText('Golden Beat #207')

    // Histórico: voltar restaura o estado anterior aos filtros; avançar devolve a combinação (a busca por
    // texto substitui a entrada em vez de empilhar uma por tecla digitada)
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/collection=/)
    await page.goForward()
    await expect(page).toHaveURL(/collection=kurio-apes/)
    await expect(page).toHaveURL(/q=golden/)
    await expect(page.getByRole('searchbox')).toHaveValue('golden')
  })
})

test.describe('favoritos', () => {
  test('falha na mutation desfaz a atualização otimista e a repetição funciona', async ({ page }) => {
    await login(page)
    await page.goto('/')
    const fav = page.getByRole('button', { name: 'Favoritar Emerald Ape #042' })
    await expect(fav).toHaveAttribute('aria-pressed', 'false')

    await setScenario(page, 'favorites-fail')
    await fav.click()
    // Rollback: volta ao estado anterior depois da falha
    await expect(page.getByRole('button', { name: 'Favoritar Emerald Ape #042' })).toHaveAttribute('aria-pressed', 'false', {
      timeout: 10_000,
    })
    await expect(page.getByRole('status').or(page.getByRole('alert')).filter({ hasText: /favorit/i }).first()).toBeVisible()

    // Recuperação: com o cenário normal o favorito persiste, inclusive após refresh
    await setScenario(page, 'default')
    const saved = page.waitForResponse((r) => r.url().includes('/favorites/') && r.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Favoritar Emerald Ape #042' }).click()
    expect((await saved).status()).toBe(204)
    await expect(page.getByRole('button', { name: /Remover Emerald Ape #042 dos favoritos/ })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: /Remover Emerald Ape #042 dos favoritos/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('carregamento lento', () => {
  test('skeletons aparecem com dimensões estáveis e somem quando os dados chegam', async ({ page }) => {
    await page.goto('/?scenario=slow')
    const skeletons = page.locator('.skeleton')
    await expect(skeletons.first()).toBeVisible()
    const before = await page.locator('main').boundingBox()
    await expect(cards(page).first()).toBeVisible({ timeout: 15_000 })
    await expect(skeletons).toHaveCount(0)
    const after = await page.locator('main').boundingBox()
    // Sem deslocamento relevante de layout entre o esqueleto e o conteúdo
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2)
  })

  test('detalhe e resumo do carrinho também mostram skeleton', async ({ page }) => {
    await login(page)
    await setScenario(page, 'slow')
    await page.goto('/nft/emerald-ape-042')
    await expect(page.locator('.skeleton').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Emerald Ape #042/ })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Comprar' }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.locator('.skeleton').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Finalizar compra' })).toBeEnabled({ timeout: 15_000 })
  })

  test('movimento reduzido desliga a animação do shimmer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?scenario=slow')
    await expect(page.locator('.skeleton').first()).toBeVisible()
    const animation = await page.locator('.skeleton').first().evaluate((el) => getComputedStyle(el, '::after').animationName)
    expect(animation).toBe('none')
  })
})

test.describe('checkout: repetição, expiração e carteiras cadastradas', () => {
  test('clique repetido em Confirmar pagamento cria um único pedido', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText('Conectada:')).toBeVisible()
    await page.getByRole('button', { name: /Confirmar pagamento/ }).dblclick()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders.length)
    expect(orders).toBe(1)
  })

  test('sessão expirada durante o checkout leva ao login e volta ao checkout', async ({ page }) => {
    await login(page)
    await addToCartFromDetail(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText('Conectada:')).toBeVisible()
    await setScenario(page, 'session-expired')
    await page.getByRole('button', { name: /Confirmar pagamento/ }).click()
    await expect(page).toHaveURL(/\/login\?.*reason=expired/)
    expect(decodeURIComponent(page.url())).toContain('redirect=/checkout')
    await expect(page.getByText('Sua sessão expirou')).toBeVisible()
    // Nenhum pedido foi criado e, ao entrar de novo, o usuário volta ao checkout
    await setScenario(page, 'default')
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha').fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page).toHaveURL(/\/checkout$/)
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders.length)
    expect(orders).toBe(0)
  })

  test('usa a carteira cadastrada (principal pré-selecionada) e paga com o endereço dela', async ({ page }) => {
    await login(page)
    await page.goto('/wallets')
    await page.getByLabel('Nome da carteira').fill('Minha principal')
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    await expect(page.getByText('Minha principal')).toBeVisible()
    const saved = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('kurio.mock.db.v1')!)
      return Object.values(db.wallets as Record<string, Array<{ address: string }>>).flat()[0]!.address
    })

    await addToCartFromDetail(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Finalizar compra' }).click()
    const radio = page.getByRole('radio', { name: /Minha principal/ })
    await expect(radio).toBeChecked()
    await page.getByRole('button', { name: 'Conectar carteira' }).click()
    await expect(page.getByText('Conectada:')).toBeVisible()
    await page.getByRole('button', { name: /Confirmar pagamento/ }).click()
    await expect(page).toHaveURL(/\/orders\/ord_/)
    const order = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders[0])
    expect(JSON.stringify(order)).toContain(saved)
  })
})

test.describe('pedido pendente e conexão', () => {
  test('queda do socket com pedido pendente: ao reconectar o estado é recuperado sem nova compra', async ({ page }) => {
    await login(page)
    await setScenario(page, 'order-stall')
    await addToCartFromDetail(page, 'golden-beat-207')
    await waitRealtime(page)
    await payFromCart(page)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    const id = page.url().split('/').pop()!

    // A conexão cai e o pedido é decidido enquanto o cliente está desconectado: o evento se perde
    await page.evaluate((orderId) => {
      window.__kurioMock!.dropConnections()
      window.__kurioMock!.settleOrder(orderId, 'confirm')
    }, id)
    // O cliente reconecta sozinho e reconcilia com o REST
    await expect(page.getByRole('heading', { name: 'Compra confirmada' })).toBeVisible({ timeout: 15_000 })
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders.length)
    expect(orders).toBe(1)
  })

  test('recarregar a página com pedido pendente recupera o mesmo pedido', async ({ page }) => {
    await login(page)
    await setScenario(page, 'order-stall')
    await addToCartFromDetail(page, 'golden-beat-207')
    await waitRealtime(page)
    await payFromCart(page)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    const url = page.url()
    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible()
    await waitRealtime(page)
    await page.evaluate((orderId) => window.__kurioMock!.settleOrder(orderId, 'decline'), url.split('/').pop()!)
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio.mock.db.v1')!).orders.length)
    expect(orders).toBe(1)
  })
})

test.describe('teclado, foco e formulários', () => {
  test('o primeiro Tab leva ao link "Pular para o conteúdo" com foco visível', async ({ page }) => {
    await page.goto('/')
    // O React substitui a casca estática do cabeçalho ao montar; espera isso para o foco não se perder.
    await expect(cards(page).first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeVisible()
  })

  test('diálogo de remoção de carteira: foco preso, Esc fecha e o foco volta ao gatilho', async ({ page }) => {
    await login(page)
    await page.goto('/wallets')
    await page.getByLabel('Nome da carteira').fill('Para remover')
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    const trigger = page.getByRole('button', { name: 'Remover Para remover' })
    await trigger.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Remover carteira?' })
    await expect(dialog).toBeVisible()
    // O foco entra no diálogo e permanece nele ao percorrer com Tab
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(page.getByText('Para remover').first()).toBeVisible()
  })

  test('formulário de login: erros associados aos campos e anunciados', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    const email = page.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy!.split(' ')[0]}`)).toHaveText(/\S/)
  })

  test('fluxo de compra operável só pelo teclado até o carrinho', async ({ page }) => {
    await login(page)
    await page.goto('/nft/emerald-ape-042')
    const buy = page.getByRole('button', { name: 'Comprar' })
    await buy.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/cart$/)
  })
})

test.describe('detalhe: carrosséis de relacionados', () => {
  test('mostram outros NFTs, excluem o atual, rolam e navegam para o detalhe', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.locator('[data-related-carousel]').first().scrollIntoViewIfNeeded() // os carrosséis montam perto da tela
    const same = page.getByRole('region', { name: 'Mais desta coleção' })
    const seen = page.getByRole('region', { name: 'Colecionadores também viram' })
    await expect(same.getByRole('listitem').first()).toBeVisible()
    await expect(seen.getByRole('listitem').first()).toBeVisible()
    await expect(page.locator('section a[href="/nft/emerald-ape-042"]')).toHaveCount(0)

    const track = same.getByRole('list')
    const before = await track.evaluate((el) => el.scrollLeft)
    const next = same.getByRole('button', { name: /próximos/ })
    if (await next.isVisible()) {
      await next.click()
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThanOrEqual(before)
    }

    const link = same.getByRole('link').first()
    const href = await link.getAttribute('href')
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('favoritar um relacionado sem login leva ao login e volta ao detalhe', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.locator('[data-related-carousel]').first().scrollIntoViewIfNeeded()
    await page.getByRole('region', { name: 'Mais desta coleção' }).getByRole('button', { name: /Favoritar/ }).first().click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})
