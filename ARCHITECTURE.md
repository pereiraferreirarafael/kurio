# Arquitetura — Kurio

Este documento registra as decisões e os contratos do front-end. O código é a fonte da verdade; aqui estão os
*porquês* e os limites conhecidos.

## 1. Visão geral

```text
UI (features/*)  ──hooks──►  TanStack Query  ──►  Axios (api/client.ts)  ──►  MSW (REST)
      ▲                           ▲                                              │
      │                           └──── reconciliação (realtime/events.ts) ◄─── Socket.IO real ◄── MSW (ws.link)
      └── TanStack Router: estado de listagem na URL, guarda de rotas privadas (_authed)
```

- **Toda** leitura e escrita passa por Axios → MSW. Nenhum componente lê fixtures.
- **Tempo real** usa o `socket.io-client` real. O servidor é simulado com `ws.link` + `@mswjs/socket.io-binding`.
  A UI não emite eventos: eles nascem no "servidor" (`mocks/control.ts`, timers de pedido).
- O estado do servidor simulado (`mocks/db.ts`) é único: REST e Socket leem do mesmo banco, então nunca divergem
  por construção de mock. A reconciliação no cliente existe porque a rede real pode entregar fora de ordem.

## 2. Contratos (`src/api/contracts.ts`)

Schemas Zod são a definição única; os tipos TypeScript são inferidos deles. O cliente valida as respostas e o
MSW valida os corpos recebidos.

- **Dinheiro**: valores em ETH são *strings decimais* (`"1.25"`), nunca `number`. Cálculos com `decimal.js`
  (`lib/money.ts`); o total do carrinho é recomputado pelo servidor na cotação.
- **Erros**: corpo `{ error: { code, message, fields? } }` com códigos `VALIDATION_ERROR` (422),
  `UNAUTHENTICATED`/`SESSION_EXPIRED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409) e
  `TRANSIENT` (503). O cliente converte tudo em `ApiError` (`kind`, `status`, `fields`); nenhum `AxiosError`
  chega à UI. Falhas de rede e *timeout* (8 s) viram `NETWORK_ERROR` e `TIMEOUT`.
- **Endpoints**: `GET /nfts` (filtros, busca, ordenação, paginação), `GET /nfts/:id`, `GET /session`,
  `POST /auth/{signup,login,logout}`, `GET|PUT|DELETE /favorites`, `GET/PUT/DELETE /cart…`, `POST /cart/merge`,
  `PUT|DELETE /cart/coupon`, `POST /coupons/validate`, `POST /quote`, `POST /wallet/connect`,
  `GET|POST /orders`, `GET /orders/:id`, `PATCH /profile`, `PUT|DELETE /profile/avatar`,
  `POST /profile/password`, `GET|POST|DELETE /wallets`, `PUT /wallets/:id/primary`.
- **Eventos** (Socket.IO): `nft.updated` e `order.updated`. Envelope comum:
  `{ eventId, type, resource: { type, id }, version, occurredAt, data }`.
  - `nft.updated.data`: `price`, `previousPrice`, `editions[{ id, available }]`.
  - `order.updated.data`: `status` (`pending | confirmed | declined`), `declineReason`, `txHash`.

## 3. Política de sessão

- Token opaco em `localStorage` (`auth/session-store.ts`), enviado no `Authorization` por um interceptor.
  TTL de 30 min no mock. `GET /session` é a fonte do usuário atual (`['session']`, `staleTime` 60 s).
- **Rotas privadas**: o grupo `_authed` tem `beforeLoad` que consulta a sessão e, sem usuário, redireciona para
  `/login?redirect=<rota>`. O parâmetro `redirect` é validado por `internalPath` (só caminhos internos começando
  por `/`, sem `//` nem esquema) para impedir *open redirect*.
- **Expiração**: resposta `SESSION_EXPIRED` dispara `sessionStore.markExpired()`; o app limpa o cache privado,
  zera `['session']` e navega a `/login?redirect=<url atual>&reason=expired`, preservando o contexto.
- **Logout**: a sessão local é apagada *de forma síncrona* antes do `POST /auth/logout` (feito com o token
  explícito, e com erro ignorado). Assim, uma navegação que interrompa a requisição não deixa token vivo.
- **Isolamento entre usuários**: todas as chaves de dados privados começam com `'user'` e incluem o id do
  usuário. `clearPrivateCache()` remove só essas chaves no login, logout, troca de usuário e expiração.
  `['session']` *não* é removida (ver §5). No servidor simulado todo recurso é filtrado pelo dono; pedido de
  outro usuário responde 404 (não vaza nem a existência).
- Troca de senha invalida as outras sessões do usuário.

## 4. Carrinho

Três estados que convergem para um só:

1. **Visitante**: itens em `localStorage` (`kurio.cart.guest`). Não há chamada de API.
2. **Autenticado**: a fonte da verdade é o servidor (`GET /cart`). Edição com *atualização otimista* e rollback
   em erro; `cart-fail` demonstra o rollback.
3. **Login com carrinho de visitante**: `POST /cart/merge` soma quantidades, respeitando o estoque. Se o merge falhar, o carrinho local é mantido (nada se perde) e o usuário é avisado.

A **cotação** (`POST /quote`) é a verdade sobre preço/estoque/cupom. Cada cotação traz uma *fingerprint* que
inclui disponibilidade; quando o que o usuário viu difere do que o servidor cotaria, o checkout mostra as
diferenças (`quote-changes`) e exige confirmação antes de pagar.

## 5. Cache do TanStack Query

| Dado | staleTime | Observação |
| --- | --- | --- |
| Catálogo, detalhe | 30 s (padrão) | atualizados também por `nft.updated` |
| Sessão | 60 s | |
| Carrinho | 10 s | invalidado por `order.updated` e `nft.updated` |
| Pedido | — | *polling* de 5 s enquanto `pending` (fallback do socket) |

- **Retry**: só para falhas transitórias (rede, *timeout*, 5xx), no máximo 2 vezes, com *backoff* exponencial
  (500 ms, 1 s, limitado a 4 s). Erros 4xx nunca são repetidos. **Mutations nunca têm retry automático**: a
  repetição é decisão explícita do usuário e, em pedidos, reaproveita a mesma `Idempotency-Key`.
- **Listagem na URL**: busca, coleção, rede, faixa de preço, aba, ordenação e página são *search params*
  validados por Zod com `.catch()` (URL inválida degrada para o padrão em vez de quebrar). O `loader` faz
  `prefetchQuery`; a navegação do histórico reproduz o estado.
- **Por que `['session']` não é removida**: `removeQueries` desacopla a query dos *observers* já montados (o
  cabeçalho); eles ficariam presos ao objeto antigo e não veriam o novo valor. Quem inicia/encerra a sessão
  escreve `['session']` explicitamente com `setQueryData`.

## 6. Pedidos e idempotência

Fluxo de `POST /orders`:

1. O cliente gera uma `Idempotency-Key` **por conteúdo** (itens, cupom, carteira) e a guarda em `sessionStorage`
   até haver sucesso ou erro definitivo.
2. O servidor **revalida** tudo via cotação (`409 UNAVAILABLE` / `QUOTE_CHANGED`). Mesma chave + mesmo conteúdo →
   devolve o mesmo pedido (replay, 200). Mesma chave + conteúdo diferente → `409 IDEMPOTENCY_MISMATCH`.
3. O pedido nasce `pending`. A "simulação de pagamento" o decide depois (timer configurável por cenário).
4. **Confirmar** decrementa o estoque (emite `nft.updated`), remove do carrinho do servidor *apenas* o que foi
   comprado, grava `txHash`, incrementa `version` e emite `order.updated` **só para o dono** (o socket do usuário
   é identificado pelo token enviado no pacote CONNECT do Socket.IO). **Recusar** preserva carrinho e estoque.
5. A UI **nunca** marca a compra como concluída por conta própria: a tela de confirmação só mostra "confirmado"
   depois de o estado do pedido (REST ou `order.updated`) dizer `confirmed`.

Se a resposta do `POST` se perder (*timeout* após criar), o checkout mantém o formulário, guarda o corpo enviado
e o retry reutiliza corpo + chave: o servidor devolve o pedido já criado em vez de duplicar.

## 7. Reconciliação REST ↔ Socket.IO

`realtime/events.ts` aplica cada evento ao cache de forma **idempotente**:

1. Valida o envelope com Zod; inválido é descartado (`invalid`).
2. `eventId` já visto → `duplicate` (memória limitada a 500 ids).
3. `version` menor ou igual à conhecida (cache de detalhe, cache de listas e rastreador) → `stale`, ignorado.
4. Caso contrário, `applied`: atualiza detalhe e todas as listas em cache, e invalida cotação e carrinho
   (preço/estoque mudaram). `order.updated` atualiza o pedido e invalida carrinho, cotação e lista de pedidos.

Reconexão: ao reconectar, o cliente invalida pedidos e catálogo e deixa o REST refazer a verdade, já que o
Socket.IO simulado não recupera estado perdido. Enquanto um pedido está `pending`, há *polling* REST de 5 s
como rede de segurança caso o evento nunca chegue.

### Limitações do Socket.IO simulado

- `REALTIME_PATH = '/kurio-rt/'` em vez do `/socket.io/` padrão: o MSW remove o prefixo padrão ao casar handlers
  e ele colidiria com o WebSocket do HMR do Vite.
- Só WebSocket (sem *long-polling*) e só o namespace `/`. Sem *rooms*: mantemos um conjunto de conexões e
  emitimos por dono.
- O binding faz o handshake do Engine.IO mas **não envia ping**; o servidor simulado envia `2` a cada 20 s,
  senão o cliente derruba a conexão.
- Sem `sid` real nem recuperação de estado: a consistência depende do REST.

## 8. Camada MSW

- `mocks/handlers/*` (REST) e `mocks/socket.ts` (WebSocket) consomem `mocks/db.ts`, persistido em
  `localStorage`. `mocks/scenarios.ts` define cenários; a latência é determinística (sequência fixa).
- `__kurioMock` (`mocks/control.ts`) expõe `setScenario`, `reset`, `emitNftUpdate`, `settleOrder`,
  `emitOrderUpdate`. Serve a testes e demonstrações; a UI não o usa.
- **Bootstrap** (`main.tsx`): a UI renderiza imediatamente e a rede fica retida por um *gate*
  (`lib/ready.ts`) até o MSW ficar ativo. O interceptor do Axios e a conexão do socket aguardam
  `whenNetworkReady()`. O `socket.io-client` é importado dinamicamente e conecta em tempo ocioso, fora do
  caminho crítico.
- **Stub de `tough-cookie`**: o MSW o puxa para um recurso de cookies que não usamos. No bundle do navegador ele
  é trocado por um *stub* mínimo (`mocks/stubs/tough-cookie.ts`, −120 KB gzip no chunk dos mocks). O Vitest usa
  o pacote real.

## 9. Desempenho

O build inclui três otimizações dirigidas pelo Lighthouse móvel (simulação 4G lenta + CPU 4×):

- CSS embutido no HTML (sem requisição bloqueante) e fontes só do subconjunto `latin`;
- *casca* estática do cabeçalho em `index.html`, que pinta antes do JS (o React a substitui ao montar);
- `modulepreload` dos chunks do caminho crítico (mocks + `msw/browser` + rota da home), que antes eram
  descobertos em série após a execução do entry.

Medição final: mobile 82 (home) e 86 (detalhe), desktop 99 — o mobile ficou abaixo da meta 90 depois de levar a home
completa do Figma. Experimentos descartados por não melhorarem a nota: casca estática do hero, adiar seções
abaixo da dobra, `content-visibility`, adiar o entry até o primeiro pintar e remover o preload de fontes. O gargalo
no simulador é LCP/FCP (custo de JS + layout), não bloqueio de thread (TBT 90–140 ms).

CLS é tratado com esqueletos de altura fixa (filtros da home; corpo do detalhe com altura mínima).

## 10. Decisões de UX

- Filtros e busca com *debounce* e resposta imune a ordem de chegada (cenário `variable`): cada consulta tem
  chave própria no Query, então uma resposta antiga nunca sobrescreve a atual.
- Estados explícitos para carregando, vazio, erro (com "Tentar novamente") e sem conexão.
- **Favoritar sem login** leva a `/login?redirect=/nft/:id` em vez de um botão desabilitado (melhor acessibilidade
  e caminho claro); ao voltar, o usuário está na mesma página.
- Formulários com validação de campo e mensagens por campo vindas do servidor (`fields`).
- Avatar: o cliente redimensiona para 256 px JPEG antes de enviar (limite de 300 mil caracteres no contrato).
- Carteiras: máximo de 5, a primeira é a principal, só uma principal, a principal não pode ser removida
  enquanto houver outras, rótulos únicos.
- Acessibilidade: *skip link*, `aria-live` nas mudanças assíncronas, foco visível, contraste verificado
  (Lighthouse a11y ≥ 97).

## 11. Limitações conhecidas

- Voltar ao checkout com o mesmo carrinho depois de um pedido pendente pode criar outro pedido pendente
  (a idempotência protege repetições do *mesmo* envio, não intenção nova).
- A carteira do checkout é separada das carteiras salvas em `/wallets` (o checkout não pré-seleciona a principal).
- Falha no merge do carrinho de visitante mantém o carrinho local e não tenta novamente sozinha.
- O aviso de "sessão expirada" sobrevive a um reload logo após a expiração (flag em `sessionStorage`).
- Token em `localStorage` (é um mock); em produção real o ideal seria cookie `HttpOnly`.
- *Baselines* visuais são de Chromium/Linux.
- Cores de erro/sucesso foram derivadas dos tokens do Figma (que não as definia).

## 12. Desvios em relação ao Figma

- **Imagens**: usam a arte real do Figma, recortada das capturas exportadas (o download direto dos ativos foi
  bloqueado no ambiente de desenvolvimento). São 4 obras (`public/nfts/art-0..3.webp`, 450 px, e as versões
  `-sm` de 300 px para cartões); os 8 NFTs do Figma reutilizam as obras como no desenho. Se quiser resolução
  maior, exporte as artes do Figma e substitua os arquivos mantendo os nomes.
- **Categorias**: o Figma lista 9 categorias; o mock tem 3 coleções (Kurio Apes, Kurio Editions, Neon Vessels).
- **Rotas `/criadores` e `/aprenda`**: existem no menu como páginas "em breve" (sem quadro no Figma).
- **Ícones sociais do rodapé**: letras no lugar dos ícones (o `aria-label` descreve o destino).
- **Filtro de preço**: slider duplo aplicado ao clicar em "Aplicar" (`minPrice`/`maxPrice` na URL).
- **Newsletter** do rodapé: `POST /newsletter` no MSW, com validação e mensagem de sucesso/erro.
- **Hero no mobile**: a imagem é ocultada para priorizar o conteúdo e o desempenho.
- **Busca**: o campo continua na barra lateral de filtros (o Figma só mostra o ícone no cabeçalho, que leva a ele).
- **Carrossel de produtos relacionados** do detalhe: não implementado.
- **Mobile de Perfil, Carteiras e Confirmação**: o Figma não traz quadros mobile dessas telas; o layout foi
  derivado dos tokens e do desktop.
- **Cabeçalho mobile** quebra em duas linhas (logo + ação / navegação) para caber com sessão iniciada.
- **Tablet (768 px)** não tem quadro no Figma; usa o ponto de quebra `sm`/`md` do Tailwind.
