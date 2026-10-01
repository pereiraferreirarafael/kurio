import { expect, test } from '@playwright/test'
import { ANA, BRUNO, login, setScenario } from './helpers'

test.describe('autenticação e sessão', () => {
  test('rota privada redireciona ao login e volta ao destino após entrar', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha').fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('credenciais erradas mostram erro sem entrar', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha').fill('errada')
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')
    await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
  })

  test('validação de campos no login', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()
    await expect(page.getByText('Informe a senha')).toBeVisible()
  })

  test('redirect externo é ignorado (sem open redirect)', async ({ page }) => {
    await page.goto('/login?redirect=https://evil.example')
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha').fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page).toHaveURL(/localhost:4173\/$/)
  })

  test('cadastro cria conta, entra e trata e-mail duplicado', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Nome de usuário').fill('carla')
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill('Senha@1234')
    await page.getByLabel('Confirmar senha').fill('Senha@1234')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    await page.getByLabel('E-mail').fill('carla@kurio.dev')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('senhas diferentes no cadastro', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Senha', { exact: true }).fill('Senha@1234')
    await page.getByLabel('Confirmar senha').fill('outra')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()
  })

  test('sessão expirada leva ao login com aviso e preserva o destino', async ({ page }) => {
    await login(page)
    await page.goto('/wallets')
    await expect(page.getByRole('heading', { name: 'Carteiras', level: 1 })).toBeVisible()
    await setScenario(page, 'session-expired')
    await page.reload()
    await expect(page).toHaveURL(/\/login\?.*reason=expired/)
    await expect(page.getByText('Sua sessão expirou')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
  })

  test('logout encerra a sessão e bloqueia rotas privadas', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)
  })

  test('não vaza dados entre usuários: favoritos, carrinho e pedidos', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/')
    await page.getByRole('button', { name: /^Favoritar Emerald Ape #042/ }).click()
    await expect(page.getByRole('button', { name: /^Remover Emerald Ape #042 dos favoritos/ })).toBeVisible()
    await page.goto('/nft/emerald-ape-042')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'adicionado' })).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()

    await login(page, BRUNO)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /^Favoritar Emerald Ape #042/ })).toBeVisible()
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })
})
