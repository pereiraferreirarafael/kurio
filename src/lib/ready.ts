/**
 * Portão de inicialização da rede simulada. A interface renderiza sem esperar os mocks
 * (melhora FCP/LCP); qualquer chamada de API ou de tempo real aguarda este portão.
 */
let gate: Promise<unknown> = Promise.resolve()

export function holdNetworkUntil(promise: Promise<unknown>) {
  gate = promise
}

export function whenNetworkReady() {
  return gate
}
