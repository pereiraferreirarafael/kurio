import { expect, test } from '@playwright/test'
import { login, setScenario } from './helpers'

test.describe('perfil e carteiras', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('edita dados, e o conflito de e-mail aparece no campo', async ({ page }) => {
    await page.goto('/profile')
    await page.getByLabel('Nome de exibição').fill('Ana S. Lima')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Dados salvos.')).toBeVisible()
    await page.getByLabel('E-mail').fill('bruno@kurio.dev')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()
  })

  test('troca de senha: atual incorreta, depois sucesso e novo login', async ({ page }) => {
    await page.goto('/profile')
    const fill = async (current: string) => {
      await page.getByLabel('Senha atual').fill(current)
      await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha@1')
      await page.getByLabel('Confirmar nova senha').fill('NovaSenha@1')
      await page.getByRole('button', { name: 'Alterar senha' }).click()
    }
    await fill('errada')
    await expect(page.getByText('A senha atual está incorreta.').first()).toBeVisible()
    await fill('Kurio@123')
    await expect(page.getByText('Senha alterada.')).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await login(page, { email: 'ana@kurio.dev', password: 'NovaSenha@1' })
  })

  test('avatar: envia e remove', async ({ page }) => {
    await page.goto('/profile')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
      'base64',
    )
    await page.setInputFiles('#avatar-file', { name: 'a.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText('Foto atualizada.')).toBeVisible()
    await expect(page.getByRole('img', { name: /Foto de/ })).toBeVisible()
    await page.getByRole('button', { name: 'Remover foto' }).click()
    await expect(page.getByText('Foto removida.')).toBeVisible()
  })

  test('avatar inválido é recusado no cliente', async ({ page }) => {
    await page.goto('/profile')
    await page.setInputFiles('#avatar-file', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByRole('alert').filter({ hasText: 'PNG, JPEG ou WebP' })).toBeVisible()
  })

  test('carteiras: primeira é principal, troca de principal e remoção com confirmação', async ({ page }) => {
    await page.goto('/wallets')
    await expect(page.getByText('Você ainda não tem carteiras')).toBeVisible()
    await page.getByLabel('Nome da carteira').fill('Principal')
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    await expect(page.locator('li', { hasText: 'Principal' }).getByText('Principal', { exact: true }).first()).toBeVisible()

    await page.getByLabel('Nome da carteira').fill('Reserva')
    await page.getByText('Polygon', { exact: true }).click()
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    await page.getByRole('button', { name: 'Tornar Reserva a carteira principal' }).click()
    await expect(page.locator('li', { hasText: 'Reserva' }).getByText('PRINCIPAL', { exact: false })).toBeVisible()

    await page.getByRole('button', { name: 'Remover Principal' }).click()
    await page.getByRole('button', { name: 'Confirmar remoção de Principal' }).click()
    await expect(page.getByRole('button', { name: 'Remover Principal' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remover Reserva' })).toBeVisible()
  })

  test('falha ao salvar carteira mostra erro e não altera a lista', async ({ page }) => {
    await page.goto('/wallets')
    await setScenario(page, 'account-fail')
    await page.getByLabel('Nome da carteira').fill('Falha')
    await page.getByRole('button', { name: 'Adicionar carteira' }).click()
    await expect(page.getByText(/Não foi possível salvar agora/)).toBeVisible()
    await expect(page.getByText('Você ainda não tem carteiras')).toBeVisible()
  })
})
