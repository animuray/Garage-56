import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import CorporatePage from '../pages/crm/CorporatePage'
import { api } from '../api'

const fx = vi.hoisted(() => {
  const car = (id: string, plate: string, archived = false) => ({
    id, make: 'Toyota', model: 'Camry', year: 2022, engineType: 'gasoline', engineVolume: 2.5, licensePlate: plate,
    mileage: 100000, isArchived: archived, corporateId: '7',
    serviceHistory: [{ id: 'h' + id, date: '2026-08-10', mileage: 99000, services: ['Замена масла'], filters: {}, total: 31500, masterName: 'Асан' }],
  })
  return {
    companies: [{
      id: '7', companyName: 'ТОО Такси', contactPerson: 'Иван', phone: '+7700', email: '', contract: '№1',
      cars: [car('1', '123ABC01')], archivedCars: [car('2', '123ABC02', true)],
    }],
  }
})

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ corporateClients: fx.companies, addCorporate: vi.fn(), updateCorporate: vi.fn(), refreshData: vi.fn() }),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: '1', role: 'admin', name: 'Админ' } }) }))
vi.mock('../api', () => ({
  api: {
    getCarDeleteRequests: vi.fn(),
    approveCarDeleteRequest: vi.fn().mockResolvedValue(undefined),
    rejectCarDeleteRequest: vi.fn().mockResolvedValue(undefined),
    restoreCar: vi.fn().mockResolvedValue(undefined),
    getCorporateTelegram: vi.fn().mockResolvedValue({ botUsername: 'bot', code: null, codeExpiresAt: null, link: null, users: [] }),
  },
}))

const REQUESTS = [
  { id: '11', kind: 'delete', corporateId: '7', companyName: 'ТОО Такси', carId: '1', carLabel: 'Toyota Camry', licensePlate: '123ABC01',
    reason: 'Автомобиль продан', requestedBy: 'Иван', status: 'pending', adminComment: '', createdAt: '2026-09-21T14:00:00Z', resolvedAt: null },
  { id: '12', kind: 'restore', corporateId: '7', companyName: 'ТОО Такси', carId: '2', carLabel: 'Toyota Camry', licensePlate: '123ABC02',
    reason: '', requestedBy: 'Иван', status: 'pending', adminComment: '', createdAt: '2026-09-21T15:00:00Z', resolvedAt: null },
  { id: '10', kind: 'delete', corporateId: '7', companyName: 'ТОО Такси', carId: null, carLabel: 'Chevrolet Lacetti', licensePlate: '123ABC03',
    reason: '', requestedBy: 'Иван', status: 'rejected', adminComment: 'Есть записи', createdAt: '2026-09-20T10:00:00Z', resolvedAt: '2026-09-20T11:00:00Z' },
]

async function openCompany() {
  render(<CorporatePage />)
  await screen.findByText('Запросы по автомобилям')
  // the company card (h3), not the chip in the banner
  const card = screen.getAllByText('ТОО Такси').find(el => el.tagName === 'H3')!
  fireEvent.click(card)
  return await screen.findByTestId('company-modal')
}

describe('CorporatePage — requests and the company window', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.getCarDeleteRequests as ReturnType<typeof vi.fn>).mockResolvedValue(REQUESTS)
  })

  it('shows a banner with the number of pending requests (delete + restore) and a chip per company', async () => {
    render(<CorporatePage />)
    expect(await screen.findByText('Запросы по автомобилям')).toBeInTheDocument()
    expect(screen.getByText('Таксопарки просят удалить или восстановить автомобили. Решение за вами.')).toBeInTheDocument()
    const banner = screen.getByText('Запросы по автомобилям').closest('div')!.parentElement!
    expect(within(banner).getAllByText('2').length).toBeGreaterThan(0)
  })

  it('the window has a fixed size: header and tab bar are outside the scrolling body', async () => {
    const modal = await openCompany()
    const header = screen.getByTestId('company-modal-header')
    const tabs = screen.getByTestId('company-modal-tabs')
    const body = screen.getByTestId('company-modal-body')
    expect(modal.className).toMatch(/h-\[min\(88vh,780px\)\]/)
    expect(modal.className).toMatch(/overflow-hidden/)
    expect(body.className).toMatch(/overflow-y-auto/)
    expect(header.contains(tabs)).toBe(true)
    expect(body.contains(tabs)).toBe(false)
    expect(body.contains(header)).toBe(false)
  })

  it('switching tabs does not move or resize the header/tab bar and does not change the tab labels', async () => {
    const modal = await openCompany()
    const tabsBefore = screen.getByTestId('company-modal-tabs')
    const shellBefore = modal.className
    const labels = () => Array.from(tabsBefore.querySelectorAll('button')).map(b => b.textContent)
    const before = labels()
    for (const name of ['История работ', 'Отчёт', 'Запросы', 'Telegram', 'Автомобили']) {
      fireEvent.click(within(tabsBefore).getByText(name))
      await waitFor(() => expect(screen.getByTestId('company-modal-tabs')).toBe(tabsBefore))   // same DOM node: nothing re-mounted
      expect(screen.getByTestId('company-modal').className).toBe(shellBefore)                    // same size classes
      expect(labels()).toEqual(before)                                                           // same labels + counters
    }
    expect(before).toEqual(['Автомобили1', 'История работ', 'Отчёт', 'Запросы2', 'Telegram'])
  })

  it('archived cars stay in the company history (they are not lost) and offer a restore', async () => {
    await openCompany()
    expect(screen.getByText(/Архив \(1\)/)).toBeInTheDocument()
    fireEvent.click(within(screen.getByTestId('company-modal-tabs')).getByText('История работ'))
    expect(await screen.findByText('123ABC02')).toBeInTheDocument()   // history of the archived car
    expect(screen.getByText('в архиве')).toBeInTheDocument()
  })

  it('requests tab: delete and restore requests are told apart, with the right action for each', async () => {
    await openCompany()
    fireEvent.click(within(screen.getByTestId('company-modal-tabs')).getByText('Запросы'))
    const body = screen.getByTestId('company-modal-body')
    expect(await within(body).findByText('Удаление')).toBeInTheDocument()
    expect(within(body).getByText('Восстановление')).toBeInTheDocument()
    expect(within(body).getByText('Удалить в архив')).toBeInTheDocument()
    expect(within(body).getByText('Восстановить')).toBeInTheDocument()
    expect(within(body).getByText('Таксопарк хочет вернуть автомобиль из архива в автопарк')).toBeInTheDocument()
    expect(within(body).getByText('«Автомобиль продан»')).toBeInTheDocument()
    expect(within(body).getByText('Отклонён')).toBeInTheDocument()   // history of decisions
  })

  it('approving a restore request asks for confirmation in the CRM dialog and calls the API', async () => {
    await openCompany()
    fireEvent.click(within(screen.getByTestId('company-modal-tabs')).getByText('Запросы'))
    fireEvent.click(await screen.findByText('Восстановить'))
    expect(await screen.findByText('Восстановить автомобиль?')).toBeInTheDocument()
    expect(screen.getByText('Автомобиль вернётся в автопарк таксопарка — на сайте и в Telegram-боте.')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Восстановить').pop()!)   // the dialog's confirm button
    await waitFor(() => expect(api.approveCarDeleteRequest).toHaveBeenCalledWith('12'))
  })

  it('a new request from the bot appears on the page by itself when the server reports it (no reload)', async () => {
    render(<CorporatePage />)
    await screen.findByText('Запросы по автомобилям')
    const calls = (api.getCarDeleteRequests as ReturnType<typeof vi.fn>).mock.calls.length
    ;(api.getCarDeleteRequests as ReturnType<typeof vi.fn>).mockResolvedValue([
      ...REQUESTS,
      { id: '13', kind: 'delete', corporateId: '7', companyName: 'ТОО Такси', carId: '1', carLabel: 'Toyota Camry', licensePlate: '123ABC01',
        reason: '', requestedBy: 'Иван', status: 'pending', adminComment: '', createdAt: '2026-09-21T16:00:00Z', resolvedAt: null },
    ])
    const banner = () => screen.getByText('Запросы по автомобилям').closest('div')!.parentElement!
    expect(within(banner()).getAllByText('2').length).toBeGreaterThan(0)
    act(() => { window.dispatchEvent(new CustomEvent('crm-live', { detail: { type: 'car_request', requestKind: 'delete', ts: 1 } })) })
    await waitFor(() => expect((api.getCarDeleteRequests as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(calls))
    await waitFor(() => expect(within(banner()).getAllByText('3').length).toBeGreaterThan(0))
  })

  it('an unrelated live event does not reload the requests', async () => {
    render(<CorporatePage />)
    await screen.findByText('Запросы по автомобилям')
    const calls = (api.getCarDeleteRequests as ReturnType<typeof vi.fn>).mock.calls.length
    act(() => { window.dispatchEvent(new CustomEvent('crm-live', { detail: { type: 'booking', source: 'site', ts: 1 } })) })
    await new Promise(r => setTimeout(r, 50))
    expect((api.getCarDeleteRequests as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })

  it('rejecting a delete request sends the admin comment', async () => {
    await openCompany()
    fireEvent.click(within(screen.getByTestId('company-modal-tabs')).getByText('Запросы'))
    const body = screen.getByTestId('company-modal-body')
    fireEvent.click((await within(body).findAllByText('Отклонить'))[0])
    fireEvent.change(await screen.findByPlaceholderText(/незавершённые записи/), { target: { value: 'Есть незавершённые записи' } })
    fireEvent.click(screen.getByText('Отклонить запрос'))
    await waitFor(() => expect(api.rejectCarDeleteRequest).toHaveBeenCalledWith('11', 'Есть незавершённые записи'))
  })
})
