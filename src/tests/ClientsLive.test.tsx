import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, within } from '@testing-library/react'
import ClientsPage from '../pages/crm/ClientsPage'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    getCarBrands: vi.fn().mockResolvedValue([]),
    getClients: vi.fn(),
    getNewClients: vi.fn(),
    markClientsSeen: vi.fn().mockResolvedValue(undefined),
  },
}))

const client = (id: string, name: string) => ({
  id, name, phone: '+7700' + id, email: '', visitCount: 0, isRegular: false, totalSpent: 0, createdAt: '', cars: [],
})
const setClients = (list: ReturnType<typeof client>[]) => (api.getClients as ReturnType<typeof vi.fn>).mockResolvedValue(list)
const setNew = (ids: string[]) => (api.getNewClients as ReturnType<typeof vi.fn>).mockResolvedValue({ count: ids.length, ids })
const rowOf = (name: string) => screen.getAllByText(name)[0].closest('tr, div[class*="cursor-pointer"]') as HTMLElement

describe('ClientsPage — live updates and the "new" mark', () => {
  beforeEach(() => { vi.clearAllMocks(); setClients([client('1', 'Старый Клиент')]); setNew([]) })

  it('shows a new client on the page by itself, marked as new, when the server reports it (no reload)', async () => {
    render(<ClientsPage />)
    expect((await screen.findAllByText('Старый Клиент')).length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Айгерим')).toHaveLength(0)

    setClients([client('2', 'Айгерим'), client('1', 'Старый Клиент')])
    setNew(['2'])
    act(() => { window.dispatchEvent(new CustomEvent('crm-live', { detail: { type: 'client', clientId: '2', ts: 1 } })) })

    expect((await screen.findAllByText('Айгерим')).length).toBeGreaterThan(0)
    await waitFor(() => expect(within(rowOf('Айгерим')).getAllByText('Новый').length).toBeGreaterThan(0))
    expect(within(rowOf('Старый Клиент')).queryAllByText('Новый')).toHaveLength(0)
    await waitFor(() => expect(api.markClientsSeen).toHaveBeenCalled())   // the sidebar badge clears
  })

  it('marks several clients that arrive one after another, keeping the earlier marks', async () => {
    render(<ClientsPage />)
    await screen.findAllByText('Старый Клиент')
    setClients([client('2', 'Первый'), client('1', 'Старый Клиент')]); setNew(['2'])
    act(() => { window.dispatchEvent(new CustomEvent('crm-live', { detail: { type: 'client', ts: 1 } })) })
    await screen.findAllByText('Первый')
    setClients([client('3', 'Второй'), client('2', 'Первый'), client('1', 'Старый Клиент')]); setNew(['3'])
    act(() => { window.dispatchEvent(new CustomEvent('crm-live', { detail: { type: 'client', ts: 2 } })) })
    await screen.findAllByText('Второй')
    await waitFor(() => expect(within(rowOf('Второй')).getAllByText('Новый').length).toBeGreaterThan(0))
    expect(within(rowOf('Первый')).getAllByText('Новый').length).toBeGreaterThan(0)
  })

  it('other kinds of events do not reload the clients', async () => {
    render(<ClientsPage />)
    await screen.findAllByText('Старый Клиент')
    const calls = (api.getClients as ReturnType<typeof vi.fn>).mock.calls.length
    act(() => { window.dispatchEvent(new CustomEvent('crm-live', { detail: { type: 'booking', ts: 1 } })) })
    await new Promise(r => setTimeout(r, 50))
    expect((api.getClients as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })

  it('marks the clients that were added since the last visit when the page opens', async () => {
    setClients([client('2', 'Айгерим'), client('1', 'Старый Клиент')]); setNew(['2'])
    render(<ClientsPage />)
    await waitFor(() => expect(within(rowOf('Айгерим')).getAllByText('Новый').length).toBeGreaterThan(0))
    expect(api.markClientsSeen).toHaveBeenCalledTimes(1)
  })
})
