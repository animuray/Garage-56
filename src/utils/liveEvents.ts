import { API_BASE_URL } from '../api'

// Live events from the server (Server-Sent Events over fetch, so the token stays in the Authorization header).
// The moment something happens (a booking, a request from a taxi fleet, a new client…) the server pushes it here,
// so the CRM can react at once instead of waiting for the next poll.
export interface LiveEvent {
  type: 'hello' | 'booking' | 'booking_cancelled' | 'car_request' | 'appointment_cancel_request' | 'client' | 'bot_linked' | 'data' | string
  title?: string
  body?: string
  url?: string
  source?: 'site' | 'telegram'
  requestKind?: 'delete' | 'restore'
  bookingId?: string
  requestId?: string
  clientId?: string
  what?: 'appointments' | 'car_requests' | 'appointment_cancel_requests' | string   // for the silent type 'data': which lists to reload
  ts: number
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** Opens the stream and keeps it open (reconnecting with back-off). Returns a function that closes it. */
export function subscribeLive(onEvent: (e: LiveEvent) => void, onStatus?: (connected: boolean) => void): () => void {
  let stopped = false
  let ctrl: AbortController | null = null

  const run = async () => {
    let attempt = 0
    while (!stopped) {
      const token = localStorage.getItem('token')
      if (!token) { await sleep(5000); continue }
      ctrl = new AbortController()
      try {
        const res = await fetch(`${API_BASE_URL}/api/live`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
        if (res.status === 401 || res.status === 403) return   // this account has no live stream: nothing to retry
        if (!res.ok || !res.body) throw new Error(`live stream: HTTP ${res.status}`)
        attempt = 0
        onStatus?.(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (!stopped) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let i: number
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const line = frame.split('\n').find(l => l.startsWith('data: '))
            if (!line) continue   // ": ping" heartbeat
            try { onEvent(JSON.parse(line.slice(6)) as LiveEvent) } catch { /* a broken frame must not kill the stream */ }
          }
        }
      } catch { if (stopped) return }
      onStatus?.(false)
      await sleep(Math.min(30_000, 1000 * 2 ** attempt++))
    }
  }
  void run()

  return () => { stopped = true; ctrl?.abort() }
}

/** Page-level helper: run `fn` whenever the layout relays a live event of one of these types. */
export const LIVE_WINDOW_EVENT = 'crm-live'
export const relayLive = (e: LiveEvent) => window.dispatchEvent(new CustomEvent<LiveEvent>(LIVE_WINDOW_EVENT, { detail: e }))
export function onLive(handler: (e: LiveEvent) => void): () => void {
  const h = (ev: Event) => handler((ev as CustomEvent<LiveEvent>).detail)
  window.addEventListener(LIVE_WINDOW_EVENT, h)
  return () => window.removeEventListener(LIVE_WINDOW_EVENT, h)
}
