# Kurio — Marketplace de NFTs

Front-end do desafio "Marketplace de NFTs" (React + TypeScript), implementado a partir do Figma. Toda a
comunicação é feita por REST (Axios) e Socket.IO real contra uma API **simulada com MSW**, então o projeto
roda sem nenhum back-end.

- Decisões de arquitetura, contratos, política de sessão, cache e reconciliação REST ↔ Socket: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Demonstração pública: <https://kurio-ivory.vercel.app> (mocks ligados; login de teste na seção "Contas de teste")

## Stack

React 19 · TypeScript · Vite · TanStack Router (rotas por arquivo, *search params* na URL, guarda de rotas
privadas) · TanStack Query · Axios · socket.io-client · Tailwind CSS v4 · shadcn/ui (Radix Slot + CVA) · MSW
(REST + Socket.IO via `@mswjs/socket.io-binding`) · Zod · Vitest · Playwright · Lighthouse.

## Como rodar

Requisitos: Node 22+ e npm.

```bash
npm ci
npm run dev          # http://localhost:5173
```

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento com mocks ativos |
| `npm run build` | `tsc -b` + build de produção em `dist/` |
| `npm run preview` | serve o build em `http://localhost:4173` |
| `npm test` | testes unitários/de integração dos mocks (Vitest, 54 testes) |
| `npm run lint` | Oxlint |
| `npm run e2e` | Playwright (funcional + regressão visual, desktop e mobile) |
| `npm run lighthouse` | auditoria Lighthouse (mediana de 3 execuções) |

### Variáveis de ambiente

Copie `.env.example` para `.env` se quiser alterar algo. Todas têm valor padrão no código.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | liga a camada MSW (REST + Socket.IO). Mantida ligada também no deploy. |
| `VITE_MOCK_SCENARIO` | `default` | cenário inicial dos mocks |
| `VITE_API_BASE_URL` | `/api` | base da API REST |

Para os testes e auditorias em máquinas em que o Playwright não baixou o navegador, aponte o Chromium:
`CHROMIUM_PATH` (Playwright) e `CHROME_PATH` (Lighthouse).

## Credenciais fictícias

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana | `ana@kurio.dev` | `Kurio@123` |
| Bruno | `bruno@kurio.dev` | `Kurio@456` |

Também é possível criar uma conta em `/signup`. Os dados de cada usuário (carrinho, favoritos, pedidos,
carteiras, perfil) são isolados: um usuário nunca vê dados do outro.

## Mocks: cenários, persistência e reset

O banco simulado é determinístico e persiste em `localStorage` (`kurio.mock.db.v1`), então sobrevive a
*refresh*. A latência de cada cenário é determinística (sequência fixa dentro da faixa), sem `Math.random`.

### Escolher o cenário

Precedência: `?scenario=` na URL (persistido) › `localStorage` › `VITE_MOCK_SCENARIO` › `default`.

```text
http://localhost:5173/?scenario=error-503
```

No console do navegador:

```js
__kurioMock.scenarios          // lista nomes e descrições
__kurioMock.setScenario('slow')
__kurioMock.getScenario()
```

### Resetar

```js
__kurioMock.reset()            // restaura banco, relógio de latência e sessão; recarrega a página
```

### Cenários disponíveis

| Cenário | Efeito / como reproduzir a falha |
| --- | --- |
| `default` | sucesso, latência 80–250 ms |
| `instant` | sem latência artificial (auditorias) |
| `slow` | 1,5–3 s em toda requisição |
| `variable` | 50–2500 ms: respostas chegam fora de ordem (busca/filtros) |
| `empty` | catálogo vazio |
| `error-500` / `error-503` | `GET /nfts` falha (tela de erro com "Tentar novamente") |
| `offline` | falha de conexão em tudo |
| `timeout` | nenhuma resposta (estoura o timeout de 8 s do Axios) |
| `favorites-fail` | favoritar falha → rollback da atualização otimista |
| `cart-fail` | escritas do carrinho falham → rollback |
| `quote-503` | `POST /quote` responde 503 (checkout não permite pagar) |
| `order-declined` | pagamento recusado pela simulação (carrinho e estoque preservados) |
| `order-slow` | pedido fica *pendente* por 8 s antes de confirmar |
| `order-stall` | pedido fica pendente até você resolver: `__kurioMock.settleOrder('<id>', 'confirm' \| 'decline')` |
| `order-create-fails` | `POST /orders` responde 503 sem criar pedido |
| `order-timeout-after-create` | o pedido é criado mas a resposta nunca chega; o retry reaproveita a `Idempotency-Key` e recupera o mesmo pedido |
| `wallet-refused` | a carteira recusa a conexão |
| `account-fail` | escritas de perfil e carteiras respondem 503 |
| `session-expired` | toda chamada autenticada responde `SESSION_EXPIRED` |

### Disparar eventos em tempo real (sem mexer na UI)

A UI nunca simula eventos por conta própria. Eles saem do "servidor" MSW pelo Socket.IO:

```js
__kurioMock.emitNftUpdate('<nftId>', { price: '2.5', availability: { '<editionId>': 0 } })
__kurioMock.emitNftUpdate('<nftId>', {}, { duplicate: true })   // mesmo eventId duas vezes
__kurioMock.emitNftUpdate('<nftId>', {}, { stale: true })       // versão antiga (deve ser ignorada)
__kurioMock.emitOrderUpdate('<orderId>', { duplicate: true })
__kurioMock.connectedClients()                                  // conexões abertas
__kurioMock.dropConnections()                                   // derruba os sockets (o cliente reconecta e reconcilia)
```

## Testes

### Unitários / integração (Vitest)

`npm test` — valores monetários (decimal), reconciliação de eventos (duplicata, versão antiga, evento
inválido) e a API simulada inteira (catálogo, sessão, carrinho, cotação, pedidos idempotentes, perfil,
carteiras, Socket.IO).

### E2E (Playwright)

```bash
npx playwright install chromium   # uma vez
npm run e2e
npx playwright show-report        # relatório HTML (traces/screenshots/vídeos das falhas)
```

- Três projetos: `chromium-desktop` (1440×900), `chromium-mobile` (Pixel 7, 390 px) e `chromium-tablet` (768×1024, só regressão visual).
- O `webServer` faz `npm run build` e serve o build (`vite preview`), ou seja, testa o que vai para produção.
- Cobre: catálogo e URL, login/cadastro/logout e rota privada, favoritos com rollback, carrinho, cotação,
  compra (confirmada, recusada, pendente, timeout após criação com recuperação idempotente), perfil,
  carteiras, isolamento entre usuários e tempo real (`nft.updated`, `order.updated`, duplicata, versão antiga).
- `e2e/coverage.spec.ts`: ordenação e histórico do navegador, filtros combinados, esqueletos com resposta lenta
  (e `prefers-reduced-motion`), clique duplo em pagar, sessão expirada no checkout, checkout com carteira
  cadastrada, queda do Socket.IO com pedido pendente (`__kurioMock.dropConnections()`), reload com pedido
  pendente, *skip link*, foco do diálogo (trap, Esc, retorno), `aria-invalid`/`aria-describedby` e compra por teclado e carrosséis de relacionados.
- `e2e/responsive.spec.ts`: 390/768/1440 px e zoom de 200 % sem rolagem horizontal, em páginas públicas e privadas.
- Regressão visual em `e2e/visual.spec.ts` (home, detalhe, login, cadastro, carrinho, pagamento, perfil e carteiras) em 390, 768 e 1440 px, com *baselines* em `e2e/__screenshots__/<projeto>/`.

> Os *baselines* foram gerados em Chromium/Linux. Em outro sistema operacional a renderização de fontes
> difere: rode `npx playwright test visual --update-snapshots` uma vez antes de comparar.

### Lighthouse

```bash
npm run lighthouse                       # home e detalhe, mobile e desktop, mediana de 3
LH_RUNS=1 npm run lighthouse             # execução rápida
LH_URL=https://kurio-ivory.vercel.app npm run lighthouse
```

Saída em `lighthouse-reports/` (JSON + HTML por execução e `median-summary.json`; pasta ignorada pelo Git).
O script retorna código 1 se alguma meta não for atingida: Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90.

**Relatórios versionados**: `docs/lighthouse/` (HTML das 12 execuções + `median-summary.json`), gerados em 01/10/2026.

| Item | Valor |
| --- | --- |
| Lighthouse | 13.5.0 |
| Navegador | HeadlessChrome 141 (Chromium do Playwright), `--headless=new --no-sandbox --disable-gpu` |
| Node / SO | v22.22.2 / Linux 6.18 (container, sem outras cargas durante as execuções) |
| Alvo | build de produção local (`vite preview`, `localhost:4173`), cenário `default` |
| Mobile | emulação padrão do Lighthouse: Moto G Power, 4G lenta (RTT 150 ms, 1,6 Mbps), CPU 4× |
| Desktop | preset desktop do Lighthouse (sem *throttling* adicional) |
| Amostragem | 3 execuções por combinação; vale a mediana |

Medianas de 3 execuções:

| Página | Dispositivo | Perf | A11y | BP | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | mobile | **72** | 100 | 100 | 100 | 3,6 s | 506 ms | 0 |
| Home | desktop | 99 | 100 | 100 | 100 | 0,8 s | 5 ms | 0 |
| Detalhe | mobile | **80** | 100 | 100 | 100 | 3,4 s | 313 ms | 0 |
| Detalhe | desktop | 98 | 100 | 100 | 100 | 0,8 s | 0 ms | 0 |

### Justificativa: Performance no mobile abaixo de 90

A meta de Performance **não foi atingida no mobile** (home 72, detalhe 80); Acessibilidade, Boas práticas e SEO
passam em todas as páginas e o desktop passa em tudo. As notas oscilam até ±8 pontos entre execuções e baterias no simulador (a home variou de 72 a 82 sem mudar o código),
então a diferença para 90 é maior que o ruído. O que o relatório mostra:

- **Home**: o LCP é o parágrafo do hero. TTFB é 15 ms e o *element render delay* é ~1,3 s: o texto só existe depois
  que o JS carrega, executa e o React monta. Tempo de *script evaluation* ~1,2 s sob CPU 4× (bundle de entrada
  290 KB / 94 KB gzip + chunks de roteador, `msw/browser` e dados mock), mais ~0,7 s de *style & layout* da home completa do Figma.
- **Detalhe**: o LCP é a imagem principal. Ela não está no HTML inicial (SPA), e só é descoberta depois que o JS monta a
  página e a API simulada responde: ~0,76 s de *resource load delay*.
- **Causa estrutural**: é uma SPA com renderização no cliente e um "servidor" MSW que precisa subir (Service Worker +
  handlers) antes da primeira resposta de API. Em produção real, SSR/pré-renderização e CDN resolveriam LCP; aqui o desafio
  exige SPA com MSW.
- **TBT** de 300–500 ms vem da inicialização do MSW e da hidratação das listas sob CPU 4×; no desktop é ≤ 14 ms.
- Os carrosséis do detalhe só montam e buscam dados perto da tela (`IntersectionObserver`) e reservam a altura (CLS 0); sem isso o detalhe mobile caiu para 65.
- Já aplicado: CSS embutido, fontes só `latin`, casca estática do cabeçalho, `modulepreload` dos chunks críticos,
  Socket.IO e MSW carregados dinamicamente, imagens WebP com `width`/`height` e versões menores para os cartões, CLS 0.
  Experimentos descartados por não melhorarem a nota: casca estática do hero, adiar seções abaixo da dobra,
  `content-visibility`, adiar o entry até o primeiro pintar, remover preload de fontes.
- Rode contra o deploy para medir o que o avaliador vê: `LH_URL=https://kurio-ivory.vercel.app npm run lighthouse`.

## Deploy

Build estático (`dist/`) com *rewrite* de SPA para `index.html` (`vercel.json`) e mocks ligados
(`VITE_ENABLE_MOCKS` não precisa ser definida: o padrão é `true`). O Service Worker do MSW
(`public/mockServiceWorker.js`) é servido normalmente.

## Estrutura

```text
src/api         cliente Axios, contratos (Zod) e hooks do TanStack Query
src/auth        sessão (token) e redirecionamento seguro
src/cart        carrinho de visitante (localStorage)
src/features    home (hero, promoções, blog) · catalog · cart · checkout · account
src/mocks       "servidor" MSW: REST, Socket.IO, cenários, banco, pedidos
src/realtime    socket.io-client e reconciliação de eventos
src/components  cabeçalho e rodapé do site, componentes shadcn/ui
src/routes      rotas por arquivo (TanStack Router); _authed = área privada
e2e             Playwright (specs, helpers, baselines visuais)
scripts         lighthouse.mjs
```
