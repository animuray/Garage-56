import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '../api'

// Helper to build a mock Response
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('api — request()', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends Authorization header when token is in localStorage', async () => {
    localStorage.setItem('token', 'my-test-token')
    vi.mocked(fetch).mockResolvedValue(mockResponse({ token: 't', user: {} }))

    await api.login('a@b.com', 'pass')

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const headers = (opts as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-test-token')
  })

  it('does NOT send Authorization header when no token', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ token: 't', user: {} }))

    await api.login('a@b.com', 'pass')

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const headers = (opts as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  it('sends POST with JSON body for login', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ token: 'tok', user: {} }))

    await api.login('user@example.com', 'secret')

    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/api/auth/login')
    expect((opts as RequestInit).method).toBe('POST')
    expect((opts as RequestInit).body).toBe(JSON.stringify({ email: 'user@example.com', password: 'secret' }))
  })

  it('throws on non-ok response with server error message', async () => {
    // Use 422 (not 401) — 401 is special-cased to throw 'Unauthorized'
    vi.mocked(fetch).mockResolvedValue(mockResponse({ error: 'Неверный пароль' }, 422))

    await expect(api.login('a@b.com', 'wrong')).rejects.toThrow('Неверный пароль')
  })

  it('401 response throws Unauthorized and removes token', async () => {
    localStorage.setItem('token', 'old-token')
    vi.mocked(fetch).mockResolvedValue(mockResponse({ error: 'Forbidden' }, 401))

    await expect(api.getClients()).rejects.toThrow('Unauthorized')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('throws generic HTTP error when server returns no error field', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}, 500))

    await expect(api.login('a@b.com', 'x')).rejects.toThrow('HTTP 500')
  })

  it('getAnalytics appends dateFrom and dateTo query params', async () => {
    localStorage.setItem('token', 'tok')
    vi.mocked(fetch).mockResolvedValue(mockResponse({}))

    await api.getAnalytics('2026-01-01', '2026-01-31').catch(() => {})

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('dateFrom=2026-01-01')
    expect(String(url)).toContain('dateTo=2026-01-31')
  })

  it('getAnalytics without params sends no query string', async () => {
    localStorage.setItem('token', 'tok')
    vi.mocked(fetch).mockResolvedValue(mockResponse({}))

    await api.getAnalytics().catch(() => {})

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).not.toContain('?')
  })

  it('getClients with search param builds correct query string', async () => {
    localStorage.setItem('token', 'tok')
    vi.mocked(fetch).mockResolvedValue(mockResponse([]))

    await api.getClients({ search: 'Иванов' })

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('search=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2')
  })

  it('deleteAppointment sends DELETE and handles 204 No Content', async () => {
    localStorage.setItem('token', 'tok')
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) } as Response)

    const result = await api.deleteAppointment(42)
    expect(result).toBeUndefined()

    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/api/appointments/42')
    expect((opts as RequestInit).method).toBe('DELETE')
  })
})
