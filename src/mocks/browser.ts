import { setupWorker } from 'msw/browser'
import { restHandlers } from './handlers'
import { realtimeHandlers } from './socket'

export const worker = setupWorker(...restHandlers, ...realtimeHandlers)
