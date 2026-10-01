/**
 * Servidor Socket.IO simulado com MSW (ws.link + @mswjs/socket.io-binding).
 * O app usa o socket.io-client real: nada aqui substitui o cliente.
 *
 * Limitações do transporte simulado (ver ARCHITECTURE.md):
 * - Path customizado (REALTIME_PATH): o MSW remove o prefixo padrão "/socket.io/" ao casar
 *   handlers e ele colidiria com o WebSocket do HMR do Vite.
 * - Só WebSocket (sem long-polling) e só o namespace "/". Sem rooms nem broadcast nativos:
 *   mantemos um Set de conexões e emitimos em cada uma.
 * - O binding faz o handshake do Engine.IO, mas NÃO envia ping. Enviamos "2" a cada 20 s,
 *   senão o cliente derruba a conexão após pingInterval + pingTimeout.
 * - Não há sid real nem recuperação de estado do Socket.IO: a reconciliação depende do REST.
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import { REALTIME_PATH } from '@/api/contracts'
import { getDb } from './db'

const link = ws.link(new RegExp(`^wss?://[^/]+${REALTIME_PATH}?$`))

type IoClient = ReturnType<typeof toSocketIo>['client']
const clients = new Set<IoClient>()
/** Dono de cada conexão, definido pelo token do handshake (pacote CONNECT do Socket.IO). */
const owners = new Map<IoClient, string | null>()
const PING_INTERVAL_MS = 20_000

export const realtimeHandlers = [
  link.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    clients.add(io.client)
    owners.set(io.client, null)
    // Pacote CONNECT do Socket.IO: "40" + JSON de `auth`. O binding não expõe isso.
    connection.client.addEventListener('message', (event) => {
      const data = typeof event.data === 'string' ? event.data : ''
      if (!data.startsWith('40')) return
      try {
        const auth = JSON.parse(data.slice(2).replace(/^\/[^,]*,?/, '') || '{}') as { token?: string }
        const session = auth.token ? getDb().sessions[auth.token] : undefined
        owners.set(io.client, session && Date.parse(session.expiresAt) > Date.now() ? session.userId : null)
      } catch {
        owners.set(io.client, null)
      }
    })
    const ping = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      clients.delete(io.client)
      owners.delete(io.client)
    })
  }),
]

export function broadcast(event: string, payload: unknown) {
  clients.forEach((client) => client.emit(event, payload))
}

/** Eventos privados: só chegam às conexões autenticadas como o usuário dono do recurso. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  clients.forEach((client) => {
    if (owners.get(client) === userId) client.emit(event, payload)
  })
}

export function connectedClients() {
  return clients.size
}
