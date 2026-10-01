/**
 * Auditoria Lighthouse: home e detalhe, mobile e desktop, 3 execuções cada, mediana por categoria.
 * Uso: npm run build && npm run lighthouse   (sobe o `vite preview` sozinho se a porta estiver livre)
 * Variáveis: CHROME_PATH (Chromium/Chrome), LH_RUNS (padrão 3), LH_URL (padrão http://localhost:4173),
 *            LH_SCENARIO (cenário do mock; padrão `default`)
 *            LH_ONLY (opcional, ex.: `home:mobile`: roda só essa combinação página:dispositivo)
 * Saída: lighthouse-reports/{pagina}-{formfactor}-run{n}.json|html, median-summary.json e tabela no console.
 * Sai com código 1 se alguma mediana ficar abaixo das metas.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { launch } from 'chrome-launcher'
import lighthouse, { desktopConfig } from 'lighthouse'

const BASE = process.env.LH_URL ?? 'http://localhost:4173'
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = 'lighthouse-reports'
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const SCENARIO = process.env.LH_SCENARIO ?? 'default'
const PAGES = [
  { name: 'home', path: `/?scenario=${SCENARIO}` },
  { name: 'detalhe', path: `/nft/emerald-ape-042?scenario=${SCENARIO}` },
]
const FORM_FACTORS = ['mobile', 'desktop']

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function isUp() {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isUp()) return null
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' })
  for (let i = 0; i < 60 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 500))
  if (!(await isUp())) throw new Error('Servidor de preview não subiu. Rode `npm run build` antes.')
  return server
}

async function runOnce(url, formFactor) {
  const chrome = await launch({
    chromePath: process.env.CHROME_PATH || process.env.CHROMIUM_PATH || undefined,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })
  try {
    const flags = { port: chrome.port, output: ['json', 'html'], logLevel: 'error' }
    const result = await lighthouse(url, flags, formFactor === 'desktop' ? desktopConfig : undefined)
    return { lhr: result.lhr, reports: result.report }
  } finally {
    await chrome.kill()
  }
}

await mkdir(OUT, { recursive: true })
const server = await ensureServer()
const summary = []
let failed = false

try {
  for (const page of PAGES) {
    for (const formFactor of FORM_FACTORS) {
      if (process.env.LH_ONLY && process.env.LH_ONLY !== `${page.name}:${formFactor}`) continue
      const scores = Object.fromEntries(Object.keys(TARGETS).map((k) => [k, []]))
      const metrics = { lcp: [], cls: [], tbt: [] }
      for (let run = 1; run <= RUNS; run++) {
        const { lhr, reports } = await runOnce(BASE + page.path, formFactor)
        for (const key of Object.keys(TARGETS)) scores[key].push(Math.round((lhr.categories[key]?.score ?? 0) * 100))
        metrics.lcp.push(Math.round(lhr.audits['largest-contentful-paint'].numericValue))
        metrics.cls.push(Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)))
        metrics.tbt.push(Math.round(lhr.audits['total-blocking-time'].numericValue))
        const base = `${OUT}/${page.name}-${formFactor}-run${run}`
        await writeFile(`${base}.json`, reports[0])
        await writeFile(`${base}.html`, reports[1])
        console.log(`· ${page.name} ${formFactor} #${run}:`, Object.entries(scores).map(([k, v]) => `${k}=${v.at(-1)}`).join(' '))
      }
      const med = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, median(v)]))
      const ok = Object.entries(TARGETS).every(([k, min]) => med[k] >= min)
      if (!ok) failed = true
      summary.push({
        page: page.name,
        formFactor,
        runs: RUNS,
        median: med,
        allRuns: scores,
        medianMetrics: { lcpMs: median(metrics.lcp), cls: median(metrics.cls), tbtMs: median(metrics.tbt) },
        targets: TARGETS,
        passed: ok,
      })
    }
  }
} finally {
  server?.kill()
}

await writeFile(`${OUT}/median-summary.json`, JSON.stringify(summary, null, 2))
console.log('\nMediana de', RUNS, 'execuções (metas: perf≥90, a11y≥95, bp≥95, seo≥90)')
console.table(
  summary.map((s) => ({
    página: s.page,
    dispositivo: s.formFactor,
    perf: s.median.performance,
    a11y: s.median.accessibility,
    bp: s.median['best-practices'],
    seo: s.median.seo,
    'LCP ms': s.medianMetrics.lcpMs,
    CLS: s.medianMetrics.cls,
    'TBT ms': s.medianMetrics.tbtMs,
    ok: s.passed ? '✓' : '✗',
  })),
)
process.exit(failed ? 1 : 0)
