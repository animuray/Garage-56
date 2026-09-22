import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppointmentsPage from '../pages/crm/AppointmentsPage'

// Regression: the master dropdown (desktop table) is rendered via createPortal into document.body.
// React still bubbles its clicks through the component tree, not the DOM tree, so a click on a
// master name used to also fire the <tr>'s onClick and pop the "Детали записи" modal open.
const updateAppointment = vi.fn()

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: '1', role: 'admin', name: 'Админ' }, logout: vi.fn(), isAuthenticated: true }) }))
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    appointments: [
      { id: '1', date: '2027-02-02', time: '11:00', clientName: 'Иван', clientPhone: '+7700', carMake: 'Toyota', carModel: 'Camry', carYear: 2020,
        licensePlate: '123ABC02', engineType: 'Бензин', engineVolume: 2, mileage: 1, services: ['Масло'], oilPreference: '', status: 'pending', createdAt: '' },
    ],
    employees: [{ id: '9', name: 'Асан Сейткали', email: 'a@a.kz', role: 'master', isActive: true }],
    warehouse: [],
    updateAppointmentStatus: vi.fn(), updateAppointment,
  }),
}))
vi.mock('../api', () => ({
  api: {
    getNewAppointments: vi.fn().mockResolvedValue({ count: 0, items: [] }),
    markAppointmentsSeen: vi.fn().mockResolvedValue(undefined),
    getCarBrands: vi.fn().mockResolvedValue([]),
    getServices: vi.fn().mockResolvedValue([]),
  },
  API_BASE_URL: 'http://test',
}))

function renderPage() {
  return render(<MemoryRouter><AppointmentsPage /></MemoryRouter>)
}

describe('assigning a master from the appointments table', () => {
  it('does not open the appointment details modal', async () => {
    renderPage()
    // jsdom renders both the desktop table and the mobile cards at once (no media queries) —
    // scope to the (desktop) table, which is the one with the clickable master dropdown.
    const table = await screen.findByRole('table')
    const row = within(table).getByText('Иван').closest('tr')!

    fireEvent.click(within(row).getByText('— Не назначен —'))            // opens the master dropdown
    fireEvent.click(await screen.findByText('Асан Сейткали'))            // picks a master from it (portal, outside the row)

    expect(updateAppointment).toHaveBeenCalledWith('1', { masterId: '9' })
    expect(screen.queryByText('Детали записи')).not.toBeInTheDocument()
  })
})
