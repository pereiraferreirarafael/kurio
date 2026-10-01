import { expect, test } from '@playwright/test'
import { setScenario } from './helpers'

test.describe('catálogo', () => {
  test('lista 9 NFTs e mantém paginação, busca e filtros na URL', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /Emerald Ape #042/ }).first()).toBeVisible()
    await expect(page.locator('li:has(a[href^="/nft/"])')).toHaveCount(9)

    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)

    // Recarregar preserva o estado pela URL
    await page.reload()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('li:has(a[href^="/nft/"])')).toHaveCount(9)
  })

  test('busca por texto filtra e vai para a URL', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('searchbox').fill('emerald')
    await expect(page).toHaveURL(/q=emerald/)
    await expect(page.locator('li:has(a[href^="/nft/"])')).toHaveCount(1)
    await page.reload()
    await expect(page.getByRole('searchbox')).toHaveValue('emerald')
  })

  test('cenário empty mostra estado vazio', async ({ page }) => {
    await page.goto('/?scenario=empty')
    await expect(page.getByText('Nenhum NFT encontrado para estes filtros.')).toBeVisible()
  })

  test('erro 500 mostra falha e "Tentar novamente" recupera', async ({ page }) => {
    await page.goto('/?scenario=error-500')
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 20_000 })
    await setScenario(page, 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('li:has(a[href^="/nft/"])').first()).toBeVisible()
  })

  test('NFT inexistente mostra página de não encontrado', async ({ page }) => {
    await page.goto('/nft/nao-existe')
    await expect(page.getByText(/não existe|não encontrado/i)).toBeVisible()
  })
})
