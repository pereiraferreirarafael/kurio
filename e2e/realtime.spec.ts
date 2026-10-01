import { expect, test } from '@playwright/test'
import { waitRealtime } from './helpers'

test.describe('tempo real (Socket.IO)', () => {
  test('nft.updated atualiza preço no detalhe sem recarregar', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByText('1.19 ETH').first()).toBeVisible()
    await waitRealtime(page)
    await page.evaluate(() => window.__kurioMock!.emitNftUpdate('emerald-ape-042', { price: '2.50' }))
    await expect(page.getByText('2.50 ETH').first()).toBeVisible()
    await expect(page.getByText('Preço anterior')).toBeVisible()
  })

  test('evento duplicado e evento antigo não alteram o estado', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await waitRealtime(page)
    await page.evaluate(() => window.__kurioMock!.emitNftUpdate('emerald-ape-042', { price: '3.00' }, { duplicate: true }))
    await expect(page.getByText('3.00 ETH').first()).toBeVisible()
    await page.evaluate(() => window.__kurioMock!.emitNftUpdate('emerald-ape-042', {}, { stale: true }))
    await page.waitForTimeout(300)
    await expect(page.getByText('3.00 ETH').first()).toBeVisible()
  })

  test('atualização chega à listagem do catálogo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible()
    await waitRealtime(page)
    await page.evaluate(() => window.__kurioMock!.emitNftUpdate('emerald-ape-042', { price: '4.20' }))
    await expect(page.locator('li', { hasText: 'Emerald Ape #042' }).getByText('4.20 ETH')).toBeVisible()
  })

  test('estoque que zera desabilita a compra da edição', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042')
    await waitRealtime(page)
    await page.evaluate(() =>
      window.__kurioMock!.emitNftUpdate('emerald-ape-042', {
        availability: { 'emerald-ape-042-e1': 0, 'emerald-ape-042-e2': 0, 'emerald-ape-042-e3': 0 },
      }),
    )
    await expect(page.getByText('Esta edição está esgotada.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Comprar' })).toBeDisabled()
  })
})
