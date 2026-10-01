export interface Scenario {
  description: string
  /** Faixa de latência em ms. A escolha dentro da faixa é determinística. */
  latency: [min: number, max: number]
  offline?: boolean
  hang?: boolean
  emptyCatalog?: boolean
  nftsStatus?: 500 | 503
  favoritesWriteFails?: boolean
  sessionsExpired?: boolean
  cartWriteFails?: boolean
  quoteStatus?: 503
  /** Desfecho da simulação de pagamento. `stall` só resolve via controle manual. */
  orderOutcome?: 'confirm' | 'decline' | 'stall'
  /** Tempo até a simulação decidir o pedido. */
  orderSettleMs?: number
  /** POST /orders falha antes de criar qualquer coisa. */
  orderCreateFails?: boolean
  /** POST /orders cria o pedido e nunca responde (timeout depois da criação). */
  orderHangAfterCreate?: boolean
  /** A conexão da carteira é recusada. */
  walletRefuses?: boolean
  /** Escritas de perfil e carteiras falham (503). */
  accountWriteFails?: boolean
}

export const scenarios = {
  default: { description: 'Sucesso com latência baixa', latency: [80, 250] },
  instant: { description: 'Sem latência artificial (auditorias de desempenho)', latency: [0, 0] },
  slow: { description: 'Lentidão constante (1,5 a 3 s)', latency: [1500, 3000] },
  variable: {
    description: 'Latência variável: respostas chegam fora de ordem',
    latency: [50, 2500],
  },
  empty: { description: 'Catálogo vazio', latency: [80, 250], emptyCatalog: true },
  'error-500': { description: 'GET /nfts responde 500', latency: [80, 250], nftsStatus: 500 },
  'error-503': { description: 'GET /nfts responde 503', latency: [80, 250], nftsStatus: 503 },
  offline: { description: 'Falha de conexão', latency: [0, 0], offline: true },
  timeout: { description: 'Nenhuma resposta (estoura o timeout)', latency: [0, 0], hang: true },
  'favorites-fail': {
    description: 'Mutations de favoritos falham (testa rollback)',
    latency: [80, 250],
    favoritesWriteFails: true,
  },
  'cart-fail': {
    description: 'Mutations do carrinho falham (testa rollback)',
    latency: [80, 250],
    cartWriteFails: true,
  },
  'quote-503': { description: 'POST /quote responde 503', latency: [80, 250], quoteStatus: 503 },
  'order-declined': {
    description: 'Pagamento recusado pela simulação',
    latency: [80, 250],
    orderOutcome: 'decline',
    orderSettleMs: 1500,
  },
  'order-slow': {
    description: 'Pedido fica pendente por 8 s antes de confirmar',
    latency: [80, 250],
    orderSettleMs: 8000,
  },
  'order-stall': {
    description: 'Pedido fica pendente até ser resolvido manualmente (__kurioMock.settleOrder)',
    latency: [80, 250],
    orderOutcome: 'stall',
  },
  'order-create-fails': {
    description: 'POST /orders responde 503 sem criar o pedido',
    latency: [80, 250],
    orderCreateFails: true,
  },
  'order-timeout-after-create': {
    description: 'POST /orders cria o pedido mas a resposta nunca chega (testa recuperação idempotente)',
    latency: [80, 250],
    orderHangAfterCreate: true,
  },
  'wallet-refused': {
    description: 'A carteira recusa a conexão',
    latency: [80, 250],
    walletRefuses: true,
  },
  'account-fail': {
    description: 'Escritas de perfil e carteiras respondem 503',
    latency: [80, 250],
    accountWriteFails: true,
  },
  'session-expired': {
    description: 'Toda chamada autenticada responde SESSION_EXPIRED',
    latency: [80, 250],
    sessionsExpired: true,
  },
} satisfies Record<string, Scenario>

export type ScenarioName = keyof typeof scenarios
export const scenarioNames = Object.keys(scenarios) as ScenarioName[]

const STORAGE_KEY = 'kurio.mock.scenario'
let initialized = false
let requestCounter = 0

function isScenarioName(value: string | null | undefined): value is ScenarioName {
  return Boolean(value) && value! in scenarios
}

/** Precedência: ?scenario= (persistido) > localStorage > VITE_MOCK_SCENARIO > default. */
function init(defaultName: string) {
  initialized = true
  try {
    const fromUrl = new URLSearchParams(location.search).get('scenario')
    if (isScenarioName(fromUrl)) localStorage.setItem(STORAGE_KEY, fromUrl)
    else if (!localStorage.getItem(STORAGE_KEY) && isScenarioName(defaultName)) {
      localStorage.setItem(STORAGE_KEY, defaultName)
    }
  } catch {
    /* ambiente sem location/localStorage */
  }
}

let fallbackName: ScenarioName = 'default'

export function configureScenarios(defaultName: string) {
  if (isScenarioName(defaultName)) fallbackName = defaultName
  if (!initialized) init(defaultName)
}

export function getScenarioName(): ScenarioName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isScenarioName(stored)) return stored
  } catch {
    /* noop */
  }
  return fallbackName
}

export function setScenarioName(name: ScenarioName) {
  fallbackName = name
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    /* noop */
  }
  resetScenarioClock()
}

export function activeScenario(): Scenario {
  return scenarios[getScenarioName()]
}

export function resetScenarioClock() {
  requestCounter = 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** N-ésima requisição sempre recebe a mesma latência: reproduzível entre execuções. */
export function nextLatency(scenario: Scenario): number {
  const [min, max] = scenario.latency
  requestCounter += 1
  return Math.round(min + mulberry32(1337 + requestCounter)() * (max - min))
}
