import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// Permite usar um Chromium já instalado (ex.: CI ou sandbox). Sem a variável, usa o do Playwright.
const executablePath = process.env.CHROMIUM_PATH || undefined
const launchOptions = executablePath ? { executablePath } : {}

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], launchOptions },
    },
    {
      // Tablet (768 px): só regressão visual; a responsividade nos três tamanhos é testada em responsive.spec.ts
      name: 'chromium-tablet',
      testMatch: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, launchOptions },
    },
  ],
  webServer: {
    // Build de produção com mocks ligados (padrão): é o mesmo artefato que vai para o deploy.
    command: `npm run build && npm run preview -- --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
