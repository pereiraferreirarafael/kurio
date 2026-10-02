import { expect, test } from '@playwright/test'
import { addToCartFromDetail, login } from './helpers'

// Larguras exigidas: 390 (mobile), 768 (tablet) e 1440 (desktop). Roda uma vez, no projeto desktop.
const WIDTHS = [390, 768, 1440] as const
const PUBLIC = ['/', '/nft/emerald-ape-042', '/cart', '/login', '/signup']
const PRIVATE = ['/profile', '/wallets', '/checkout']

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `overflow horizontal em ${where}`).toBeLessThanOrEqual(0)
}

for (const width of WIDTHS) {
  test.describe(`largura ${width}px`, () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'larguras são fixadas pelo próprio teste')
    })

    test('telas públicas sem overflow horizontal e com navegação acessível', async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const path of PUBLIC) {
        await page.goto(path)
        await expect(page.getByRole('main')).toBeVisible()
        await expectNoHorizontalOverflow(page, `${path} @${width}`)
        await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()
      }
    })

    test('telas privadas e checkout sem overflow horizontal', async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await login(page)
      await addToCartFromDetail(page, 'emerald-ape-042', true)
      for (const path of PRIVATE) {
        await page.goto(path)
        await expect(page.getByRole('main')).toBeVisible()
        await expectNoHorizontalOverflow(page, `${path} @${width}`)
      }
    })

    test('com zoom de 200% o conteúdo continua acessível, sem rolagem horizontal', async ({ page }) => {
      // 200% de zoom equivale a metade da largura em CSS pixels
      await page.setViewportSize({ width: Math.max(320, Math.floor(width / 2)), height: 700 })
      await page.goto('/')
      await expect(page.locator('li:has(a[href^="/nft/"])').first()).toBeVisible()
      await expectNoHorizontalOverflow(page, `/ com zoom 200% @${width}`)
    })
  })
}
