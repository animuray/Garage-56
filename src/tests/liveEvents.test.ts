import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeLive, type LiveEvent } from '../utils/liveEvents'

vi.mock('../api', () => ({ API_BASE_URL: 'http://api.test' }))

const enc = new TextEncoder()
/** A response whose body delivers the given chunks one by one (like a real event stream), then ends. */
function streamResponse(chunks: string[], status = 200) {
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]))
      else controller.close()
    },
  })
  return new Response(status === 200 ? body : null, { status })
}
const frame = (o: object) => `data: ${JSON.stringify(o)}\n\n`
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

describe('subscribeLive', () => {
  beforeEach(() => { localStorage.setItem('token', 'tok'); vi.useFakeTimers({ shouldAdvanceTime: true }) })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })

  it('connects with the token in the Authorization header (never in the URL) and delivers events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([frame({ type: 'hello', ts: 1 }), frame({ type: 'booking', title: 'T', ts: 2 })]))
    vi.stubGlobal('fetch', fetchMock)
    const got: LiveEvent[] = []
    const stop = subscribeLive(e => got.push(e))
    await vi.waitFor(() => expect(got.map(e => e.type)).toEqual(['hello', 'booking']))
    stop()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/live')
    expect(url).not.toContain('tok')
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('handles frames split across chunks, heartbeats and a broken frame without dying', async () => {
    const full = frame({ type: 'client', title: 'Новый клиент', ts: 3 })
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([
      ': ping\n\n',
      full.slice(0, 15),            // half a frame…
      full.slice(15),               // …the rest arrives later
      'data: {not json}\n\n',       // garbage
      frame({ type: 'data', what: 'appointments', ts: 4 }),
    ]))
    vi.stubGlobal('fetch', fetchMock)
    const got: LiveEvent[] = []
    const stop = subscribeLive(e => got.push(e))
    await vi.waitFor(() => expect(got.map(e => e.type)).toEqual(['client', 'data']))
    expect(got[0].title).toBe('Новый клиент')
    stop()
  })

  it('reconnects on its own after the stream ends (a cut connection must not silence the CRM)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(streamResponse([frame({ type: 'booking', title: 'first', ts: 1 })]))
      .mockResolvedValue(streamResponse([frame({ type: 'booking', title: 'second', ts: 2 })]))
    vi.stubGlobal('fetch', fetchMock)
    const got: LiveEvent[] = []; const status: boolean[] = []
    const stop = subscribeLive(e => got.push(e), s => status.push(s))
    await vi.waitFor(() => expect(got.map(e => e.title)).toEqual(['first']))
    await vi.advanceTimersByTimeAsync(1500)                       // back-off, then a new connection
    await vi.waitFor(() => expect(got.map(e => e.title)).toEqual(['first', 'second']))
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(status).toContain(false)
    stop()
  })

  it('gives up quietly when the account has no live stream (403) and does not hammer the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([], 403))
    vi.stubGlobal('fetch', fetchMock)
    const stop = subscribeLive(() => {})
    await flush()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not connect without a login token, and stops when unsubscribed', async () => {
    localStorage.clear()
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    const stop = subscribeLive(() => {})
    await vi.advanceTimersByTimeAsync(4000)
    expect(fetchMock).not.toHaveBeenCalled()
    stop()
    localStorage.setItem('token', 'tok')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(fetchMock).not.toHaveBeenCalled()   // stopped for good
  })
})
