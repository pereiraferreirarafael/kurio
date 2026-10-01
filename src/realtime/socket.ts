import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { NFT_UPDATED, ORDER_UPDATED, REALTIME_PATH } from '@/api/contracts'
import { nftKeys } from '@/api/nfts'
import { whenNetworkReady } from '@/lib/ready'
import { applyNftUpdated, applyOrderUpdated, createEventTracker } from './events'

/**
 * Uma conexão por sessão. Trocar de usuário descarta socket, listeners e memória de eventos.
 *
 * O socket.io-client é importado sob demanda, e não no topo do módulo, por dois motivos:
 * 1. O engine.io-client captura `globalThis.WebSocket` ao ser avaliado. Com import estático,
 *    ele guardaria o construtor nativo antes de o MSW interceptá-lo e ignoraria os mocks.
 * 2. Mantém a biblioteca fora do bundle crítico (Lighthouse).
 */
/**
 * Vale para o módulo inteiro: trocar de usuário recria a conexão (e o createRealtime), mas o intervalo
 * sem socket também pode ter perdido eventos. Toda conexão depois da primeira reconcilia com o REST.
 */
let connectedBefore = false

export function createRealtime(qc: QueryClient) {
  const tracker = createEventTracker()
  let socket: Socket | null = null
  let generation = 0

  function disconnect() {
    generation += 1 // invalida qualquer connect() ainda aguardando o import
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
    tracker.reset()
  }

  async function connect(token: string | null) {
    disconnect()
    const current = generation
    await whenNetworkReady() // o WebSocket precisa ser interceptado pelo MSW antes de existir
    const { io } = await import('socket.io-client')
    if (current !== generation) return // desconectado (ou sessão trocada) durante o import

    socket = io(window.location.origin, {
      path: REALTIME_PATH,
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelayMax: 5000,
    })
    socket.on('connect', () => {
      // Após reconexão, reconcilia com o REST: eventos podem ter sido perdidos.
      if (connectedBefore) {
        void qc.invalidateQueries({ queryKey: nftKeys.all })
        // Carrinho e cotação dependem de preço/estoque que podem ter mudado no intervalo.
        void qc.invalidateQueries({
          predicate: (q) => q.queryKey[0] === 'user' && (q.queryKey[2] === 'cart' || q.queryKey[2] === 'quote'),
        })
        // Pedidos pendentes podem ter sido decididos enquanto estávamos offline.
        void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'orders' })
      }
      connectedBefore = true
    })
    socket.on(NFT_UPDATED, (payload: unknown) => {
      applyNftUpdated(qc, payload, tracker)
    })
    socket.on(ORDER_UPDATED, (payload: unknown) => {
      applyOrderUpdated(qc, payload, tracker)
    })
  }

  return { connect, disconnect }
}
