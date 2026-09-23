import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import CRMLayout from '../components/layout/CRMLayout'
import AppointmentsPage from '../pages/crm/AppointmentsPage'
import { api } from '../api'
import { subscribeLive, onLive, type LiveEvent } from '../utils/liveEvents'

const fx = vi.hoisted(() => ({
  appointments: [
    { id: '5', date: '2027-02-02', time: '11:00', clientName: 'ТОО Такси', clientPhone: '+7700', carMake: 'Toyota', carModel: 'Camry', carYear: 2020,
      licensePlate: '123ABC02', engineType: 'Бензин', engineVolume: 2, mileage: 1, services: ['Масло'], oilPreference: '', status: 'pending', createdAt: '', source: 'telegram', corporateId: '7' },
    { id: '6', date: '2027-02-02', time: '12:00', clientName: 'Иван из CRM', clientPhone: '+7701', carMake: 'Lada', carModel: 'Vesta', carYear: 2020,
      licensePlate: 'A111AA01', engineType: 'Бензин', engineVolume: 1.6, mileage: 1, services: ['Масло'], oilPreference: '', status: 'pending', createdAt: '' },
    { id: '8', date: '2027-02-03', time: '10:00', clientName: 'Айгерим с сайта', clientPhone: '+7702', carMake: 'Kia', carModel: 'Rio', carYear: 2021,
      licensePlate: 'B222BB01', engineType: 'Бензин', engineVolume: 1.6, mileage: 1, services: ['Масло'], oilPreference: '', status: 'pending', createdAt: '', source: 'site' },
  ],
}))

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: '1', role: 'admin', name: 'Админ' }, logout: vi.fn(), isAuthenticated: true }) }))
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    appointments: fx.appointments, employees: [], warehouse: [],
    updateAppointmentStatus: vi.fn(), updateAppointment: vi.fn(),
  }),
}))
vi.mock('../api', () => ({
  api: {
    getPublicInfo: vi.fn().mockResolvedValue({ name: 'Garage 56' }),
    getCarDeleteRequests: vi.fn().mockResolvedValue([]),
    getAppointmentCancelRequests: vi.fn().mockResolvedValue([]),
    getNewClients: vi.fn().mockResolvedValue({ count: 0, ids: [] }),
    getNewAppointments: vi.fn(),
    markAppointmentsSeen: vi.fn().mockResolvedValue(undefined),
    getCarBrands: vi.fn().mockResolvedValue([]),
    getServices: vi.fn().mockResolvedValue([]),
  },
  API_BASE_URL: 'http://test',
}))
// keep the real relay/onLive, replace only the network stream
vi.mock('../utils/liveEvents', async (orig) => ({ ...(await orig<typeof import('../utils/liveEvents')>()), subscribeLive: vi.fn(() => () => {}) }))

const item = (id: string, source: 'site' | 'telegram', clientName = 'ТОО Такси') =>
  ({ id, source, clientName, car: 'Toyota Camry', licensePlate: '123ABC02', date: '2027-02-02', time: '11:00' })
const setNew = (items: ReturnType<typeof item>[]) =>
  (api.getNewAppointments as ReturnType<typeof vi.fn>).mockResolvedValue({ count: items.length, items })

const Where = () => <div data-testid="where">{useLocation().pathname}</div>
function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/crm/dashboard']}>
      <Where />
      <Routes>
        <Route path="/crm" element={<CRMLayout />}>
          <Route path="dashboard" element={<div>dashboard page</div>} />
          <Route path="appointments" element={<div>appointments page</div>} />
          <Route path="corporate" element={<div>corporate page</div>} />
          <Route path="clients" element={<div>clients page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}
const badgeOf = (label: string) => within(screen.getByText(label).closest('a')!).queryByTitle(/Новые записи|Новые клиенты|Запросы/)?.textContent
// what the server would push to the open tab
const emit = async (e: Partial<LiveEvent> & { type: string }) => {
  const calls = (subscribeLive as ReturnType<typeof vi.fn>).mock.calls
  const handler = calls[calls.length - 1][0] as (e: LiveEvent) => void   // the handler of the newest open stream
  await act(async () => { handler({ ts: Date.now() + Math.random(), ...e } as LiveEvent) })
}

describe('live notifications in the CRM layout', () => {
  beforeEach(() => { vi.clearAllMocks(); setNew([]) })
  afterEach(() => { vi.useRealTimers() })

  it('opens the live stream for administrators', async () => {
    renderLayout()
    await waitFor(() => expect(subscribeLive).toHaveBeenCalledTimes(1))
  })

  it('a booking from a taxi fleet pops up IMMEDIATELY (no waiting for a poll) and updates the badge', async () => {
    renderLayout()
    await waitFor(() => expect(api.getNewAppointments).toHaveBeenCalled())
    setNew([item('9', 'telegram')])
    await emit({ type: 'booking', source: 'telegram', bookingId: '9', title: 'Новая запись от таксопарка', body: 'ТОО Такси · Toyota Camry · 123ABC02 · 23.09 в 11:00', url: '/crm/appointments' })
    const toast = await screen.findByTestId('toast')
    expect(within(toast).getByText('Новая запись от таксопарка')).toBeInTheDocument()
    expect(within(toast).getByText('ТОО Такси · Toyota Camry · 123ABC02 · 23.09 в 11:00')).toBeInTheDocument()
    await waitFor(() => expect(badgeOf('Записи')).toBe('1'))
  })

  it('shows a toast for every kind of event, with the right title, and opens the right page', async () => {
    renderLayout()
    await waitFor(() => expect(subscribeLive).toHaveBeenCalled())
    const cases: [Partial<LiveEvent> & { type: string }, string, string][] = [
      [{ type: 'booking', source: 'site', bookingId: '1', title: 'Новая запись с сайта', body: 'Айгерим', url: '/crm/appointments' }, 'Новая запись с сайта', '/crm/appointments'],
      [{ type: 'booking_cancelled', bookingId: '2', title: 'Таксопарк отменил запись', body: 'ТОО Такси', url: '/crm/appointments' }, 'Таксопарк отменил запись', '/crm/appointments'],
      [{ type: 'car_request', requestKind: 'delete', requestId: '3', title: 'Запрос на удаление автомобиля', body: 'ТОО Такси · 123ABC01', url: '/crm/corporate' }, 'Запрос на удаление автомобиля', '/crm/corporate'],
      [{ type: 'car_request', requestKind: 'restore', requestId: '4', title: 'Запрос на восстановление автомобиля', body: 'ТОО Такси · 123ABC02', url: '/crm/corporate' }, 'Запрос на восстановление автомобиля', '/crm/corporate'],
      [{ type: 'client', clientId: '5', title: 'Новый клиент', body: 'Айгерим · +7700', url: '/crm/clients' }, 'Новый клиент', '/crm/clients'],
      [{ type: 'bot_linked', title: 'Таксопарк подключился к боту', body: 'ТОО Такси · Иван', url: '/crm/corporate' }, 'Таксопарк подключился к боту', '/crm/corporate'],
    ]
    for (const [evt, title, url] of cases) {
      await emit(evt)
      const toast = (await screen.findAllByTestId('toast')).find(t => within(t).queryByText(title))!
      expect(toast, title).toBeTruthy()
      fireEvent.click(within(toast).getByText('Открыть →'))
      await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(url))
      await waitFor(() => expect(screen.queryByText(title)).not.toBeInTheDocument())   // opening closes the toast
    }
  })

  it('silent "data" events show no toast but are relayed so the open page reloads', async () => {
    renderLayout()
    await waitFor(() => expect(subscribeLive).toHaveBeenCalled())
    const seen: LiveEvent[] = []
    const off = onLive(e => seen.push(e))
    await emit({ type: 'data', what: 'appointments' })
    await emit({ type: 'hello' })
    off()
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    expect(seen.map(e => e.type)).toEqual(['data'])   // hello is internal
  })

  it('a real event is relayed to the pages as well', async () => {
    renderLayout()
    await waitFor(() => expect(subscribeLive).toHaveBeenCalled())
    const seen: LiveEvent[] = []; const off = onLive(e => seen.push(e))
    await emit({ type: 'car_request', requestKind: 'delete', requestId: '7', title: 'Запрос на удаление автомобиля', url: '/crm/corporate' })
    off()
    expect(seen).toHaveLength(1); expect(seen[0].requestId).toBe('7')
  })

  it('does not show the same booking twice when the live event and the safety-net poll both report it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderLayout()
    await waitFor(() => expect(api.getNewAppointments).toHaveBeenCalled())
    setNew([item('9', 'telegram')])
    const calls = (api.getNewAppointments as ReturnType<typeof vi.fn>).mock.calls.length
    await emit({ type: 'booking', source: 'telegram', bookingId: '9', title: 'Новая запись от таксопарка', body: 'x', url: '/crm/appointments' })
    // the event triggers a refresh of the counters, which finds booking 9 too — still only ONE toast
    await waitFor(() => expect((api.getNewAppointments as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(calls))
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })    // it closes by itself…
    expect(screen.queryAllByTestId('toast')).toHaveLength(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })    // …and the safety-net poll must not bring it back
    expect(screen.queryAllByTestId('toast')).toHaveLength(0)
  })

  it('the 60-second poll still works as a safety net when the live stream is down', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setNew([item('5', 'telegram')])
    renderLayout()
    await waitFor(() => expect(badgeOf('Записи')).toBe('1'))
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()   // what was already waiting is not a toast
    setNew([item('6', 'site', 'Айгерим'), item('5', 'telegram')])
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    const toast = await screen.findByTestId('toast')
    expect(within(toast).getByText('Новая запись с сайта')).toBeInTheDocument()
  })

  it('keeps at most four toasts on screen and each closes by itself after 10 seconds or by the cross', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderLayout()
    await waitFor(() => expect(subscribeLive).toHaveBeenCalled())
    for (let i = 1; i <= 6; i++) await emit({ type: 'client', clientId: String(i), title: `Клиент ${i}`, body: 'b', url: '/crm/clients' })
    expect(screen.getAllByTestId('toast')).toHaveLength(4)
    expect(screen.queryByText('Клиент 1')).not.toBeInTheDocument(); expect(screen.getByText('Клиент 6')).toBeInTheDocument()
    fireEvent.click(within(screen.getAllByTestId('toast')[0]).getByLabelText('Закрыть'))
    expect(screen.getAllByTestId('toast')).toHaveLength(3)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
  })

  it('clears the badge when the bookings page reports it has been seen', async () => {
    setNew([item('5', 'telegram')])
    renderLayout()
    await waitFor(() => expect(badgeOf('Записи')).toBe('1'))
    setNew([])
    await act(async () => { window.dispatchEvent(new Event('appointments-seen')) })
    await waitFor(() => expect(badgeOf('Записи')).toBeUndefined())
  })
})

describe('order lists: taxi fleet tag and hover colour', () => {
  beforeEach(() => { vi.clearAllMocks(); setNew([]) })
  const rowWith = (text: string) => screen.getAllByRole('row').find(r => r.textContent?.includes(text))!

  it('an order from a taxi fleet ALWAYS shows the taxi icon before the name, no text, even when nothing is new', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => expect(api.getNewAppointments).toHaveBeenCalled())
    const tag = within(rowWith('ТОО Такси')).getByTestId('taxi-tag')
    expect(tag.textContent).toBe('')   // icon only, no label
    expect(tag.querySelector('svg')).toBeTruthy()
    expect(within(rowWith('ТОО Такси')).queryByText('Новая')).not.toBeInTheDocument()
    expect(within(rowWith('ТОО Такси')).queryByTestId('taxi-tag-dot')).not.toBeInTheDocument()   // nothing new → no dot
    // regular orders carry no such tag
    expect(within(rowWith('Иван из CRM')).queryByTestId('taxi-tag')).not.toBeInTheDocument()
    expect(within(rowWith('Айгерим с сайта')).queryByTestId('taxi-tag')).not.toBeInTheDocument()
  })

  it('a still-unseen taxi fleet order keeps the same icon and only gets a small pulsing dot (no word "Новая")', async () => {
    setNew([item('5', 'telegram')])
    render(<AppointmentsPage />)
    await waitFor(() => expect(within(rowWith('ТОО Такси')).getByTestId('taxi-tag-dot')).toBeInTheDocument())
    expect(within(rowWith('ТОО Такси')).getByTestId('taxi-tag').textContent).toBe('')
    expect(within(rowWith('ТОО Такси')).queryByText('Новая')).not.toBeInTheDocument()
    await waitFor(() => expect(api.markAppointmentsSeen).toHaveBeenCalled())
    // the desktop table and the phone cards show the same icon
    expect(screen.getAllByTestId('taxi-tag').length).toBeGreaterThanOrEqual(2)
  })

  it('a fresh booking from the site is marked «Новая · с сайта»; an old one is not', async () => {
    setNew([item('8', 'site', 'Айгерим с сайта')])
    render(<AppointmentsPage />)
    await waitFor(() => expect(within(rowWith('Айгерим с сайта')).getByText('Новая')).toBeInTheDocument())
    expect(within(rowWith('Айгерим с сайта')).getByText('с сайта')).toBeInTheDocument()
    expect(within(rowWith('Иван из CRM')).queryByText('Новая')).not.toBeInTheDocument()
  })

  it('every order lights up in the SAME orange on hover — no blue anywhere; taxi orders also keep a soft orange background', async () => {
    render(<AppointmentsPage />)
    await waitFor(() => expect(api.getNewAppointments).toHaveBeenCalled())
    const taxi = rowWith('ТОО Такси'), crm = rowWith('Иван из CRM'), site = rowWith('Айгерим с сайта')
    for (const row of [taxi, crm, site]) {
      expect(row.className).toContain('hover:bg-orange-500/10')
      expect(row.className).toContain('hover:border-orange-500/20')
      expect(row.className).not.toMatch(/sky|blue|cyan/)
    }
    expect(taxi.className).toContain('bg-orange-500/[0.05]')        // always stands out
    expect(crm.className).not.toContain('bg-orange-500/[0.05]')
    expect(site.className).not.toContain('bg-orange-500/[0.05]')
  })
})

describe('"new" mark in the bookings list', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marks new bookings as seen, so the sidebar badge clears', async () => {
    setNew([item('5', 'telegram')])
    const seen = vi.fn(); window.addEventListener('appointments-seen', seen)
    render(<AppointmentsPage />)
    await waitFor(() => expect(api.markAppointmentsSeen).toHaveBeenCalled())
    await waitFor(() => expect(seen).toHaveBeenCalled())
    window.removeEventListener('appointments-seen', seen)
  })

  it('does nothing (and does not mark anything seen) when there is nothing new', async () => {
    setNew([])
    render(<AppointmentsPage />)
    await waitFor(() => expect(api.getNewAppointments).toHaveBeenCalled())
    expect(screen.queryByText('Новая')).not.toBeInTheDocument()
    expect(api.markAppointmentsSeen).not.toHaveBeenCalled()
  })
})
