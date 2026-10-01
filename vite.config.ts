import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Chunks carregados por import() dinâmico só seriam descobertos depois de o entry executar, em série.
 * Os que fazem parte do caminho crítico da home ganham modulepreload no HTML e baixam em paralelo:
 * - mocks (+ msw/browser, importado por ele): a primeira chamada de API espera o MSW ativo;
 * - routes (rota "/"): componente da home, que o roteador carregaria só após executar o entry.
 */
function preloadCriticalChunks(): Plugin {
  return {
    name: 'kurio:preload-critical-chunks',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk')
        const byFile = new Map(chunks.map((c) => [c.fileName, c]))
        const files = new Set<string>()
        for (const c of chunks) {
          if (!/^assets\/(mocks|routes)-/.test(c.fileName)) continue
          files.add(c.fileName)
          c.imports.forEach((f) => files.add(f))
          if (c.fileName.startsWith('assets/mocks-')) {
            c.dynamicImports.filter((f) => byFile.has(f)).forEach((f) => files.add(f))
          }
        }
        const scripts = [...files]
          .filter((f) => !html.includes(f))
          .map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`)
          .join('')
        // Fontes do texto da casca estática (400 e 700): carregam antes do primeiro pintar, sem troca de fonte
        // que reposicionaria o texto e adiaria o LCP.
        const fonts = Object.keys(ctx.bundle)
          .filter((f) => /roboto-mono-latin-(400|700)-normal-.*\.woff2$/.test(f))
          .map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${f}">`)
          .join('')
        return html.replace('</head>', `${fonts}${scripts}</head>`)
      },
    },
  }
}

/**
 * Embute o CSS (≈6 KB gzip) no HTML: elimina uma requisição bloqueante de renderização e a
 * espera pelas fontes só depois dela (FCP/LCP em rede lenta).
 */
function inlineCss(): Plugin {
  return {
    name: 'kurio:inline-css',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        return html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g, (tag, file: string) => {
          const asset = ctx.bundle?.[file]
          if (!asset || asset.type !== 'asset') return tag
          return `<style>${String(asset.source)}</style>`
        })
      },
    },
  }
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    preloadCriticalChunks(),
    inlineCss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Só no bundle do navegador; o Vitest (Node) usa o pacote real.
      ...(process.env.VITEST
        ? {}
        : { 'tough-cookie': path.resolve(import.meta.dirname, 'src/mocks/stubs/tough-cookie.ts') }),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
