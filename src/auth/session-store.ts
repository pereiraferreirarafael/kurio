/**
 * Token de sessão. Fica em localStorage para sobreviver a refresh (mock).
 * Não guardamos senha em lugar nenhum no cliente.
 */
const KEY = 'kurio.session.token'

type Listener = () => void
const listeners = new Set<Listener>()
const expiredListeners = new Set<Listener>()
const EXPIRED_KEY = 'kurio.session.expired'
// Sobrevive a um reload logo após a expiração (sessionStorage): o aviso no login não se perde.
const readExpired = () => {
  try {
    return sessionStorage.getItem(EXPIRED_KEY) === '1'
  } catch {
    return false
  }
}
const writeExpired = (value: boolean) => {
  try {
    if (value) sessionStorage.setItem(EXPIRED_KEY, '1')
    else sessionStorage.removeItem(EXPIRED_KEY)
  } catch {
    /* noop */
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const sessionStore = {
  getToken: read,
  setToken(token: string) {
    writeExpired(false)
    try {
      localStorage.setItem(KEY, token)
    } catch {
      /* armazenamento indisponível: sessão vale só até o refresh */
    }
    listeners.forEach((l) => l())
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* noop */
    }
    listeners.forEach((l) => l())
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Disparado quando a API responde SESSION_EXPIRED. O app decide como retomar o contexto. */
  markExpired() {
    writeExpired(true)
    sessionStore.clear()
    expiredListeners.forEach((l) => l())
  },
  /** A sessão foi encerrada pelo servidor (e não por logout)? Zera ao iniciar uma nova sessão. */
  wasExpired() {
    return readExpired()
  },
  clearExpired() {
    writeExpired(false)
  },
  onExpired(listener: Listener) {
    expiredListeners.add(listener)
    return () => expiredListeners.delete(listener)
  },
}
