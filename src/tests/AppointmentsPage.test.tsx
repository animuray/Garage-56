import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import AppointmentsPage from '../pages/crm/AppointmentsPage'

vi.mock('../api', () => ({
  api: {
    getAppointments: vi.fn().mockResolvedValue([
      { id: '1', date: '2026-08-25', time: '09:00', clientName: 'Алексей Иванов', clientPhone: '+79001111111', carMake: 'Toyota', carModel: 'Camry', carYear: 2020, licensePlate: 'A001AA', services: [], status: 'pending', total: 5000, createdAt: '', mileage: 0, engineType: 'Бензин', engineVolume: 2.0 },
      { id: '2', date: '2026-08-25', time: '10:00', clientName: 'Гульнара Абенова', clientPhone: '+79002222222', carMake: 'BMW', carModel: 'X5', carYear: 2021, licensePlate: 'B002BB', services: [], status: 'pending', total: 8000, createdAt: '', mileage: 0, engineType: 'Бензин', engineVolume: 3.0 },
      { id: '3', date: '2026-08-24', time: '11:00', clientName: 'Николай Козлов', clientPhone: '+79003333333', carMake: 'Kia', carModel: 'Rio', carYear: 2019, licensePlate: 'C003CC', services: [], status: 'completed', total: 3000, createdAt: '', mileage: 0, engineType: 'Бензин', engineVolume: 1.6 },
    ]),
    getClients: vi.fn().mockResolvedValue([]),
    getCorporate: vi.fn().mockResolvedValue([]),
    getWarehouse: vi.fn().mockResolvedValue([]),
    getEmployees: vi.fn().mockResolvedValue([]),
    getCarBrands: vi.fn().mockResolvedValue([]),
  },
}))

function renderAppointments() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppointmentsPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('AppointmentsPage', () => {
  beforeEach(() => { localStorage.setItem('token', 'test-token') })
  afterEach(() => { localStorage.clear() })

  it('renders page title', () => {
    renderAppointments()
    expect(screen.getByText('Записи')).toBeInTheDocument()
  })

  it('renders status filter tabs', () => {
    renderAppointments()
    expect(screen.getAllByText(/Ожидает/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/В работе/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Выполнено/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Отменено/).length).toBeGreaterThan(0)
  })

  it('renders pending appointments by default', async () => {
    renderAppointments()
    expect(await screen.findByText('Алексей Иванов')).toBeInTheDocument()
    expect(await screen.findByText('Гульнара Абенова')).toBeInTheDocument()
  })

  it('filters by search', async () => {
    renderAppointments()
    await screen.findByText('Алексей Иванов')
    const searchInput = screen.getByPlaceholderText('Клиент, номер, авто...')
    fireEvent.change(searchInput, { target: { value: 'Алексей' } })
    expect(screen.getByText('Алексей Иванов')).toBeInTheDocument()
    expect(screen.queryByText('Гульнара Абенова')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    renderAppointments()
    await screen.findByText('Алексей Иванов')
    fireEvent.click(screen.getByText('Выполнено'))
    expect(await screen.findByText('Николай Козлов')).toBeInTheDocument()
    expect(screen.queryByText('Алексей Иванов')).not.toBeInTheDocument()
  })

  it('shows clear button when filtering', async () => {
    renderAppointments()
    await screen.findByText('Алексей Иванов')
    const searchInput = screen.getByPlaceholderText('Клиент, номер, авто...')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    const clearBtns = screen.getAllByRole('button')
    expect(clearBtns.some(b => b.querySelector('svg'))).toBe(true)
  })

  it('shows action buttons for pending appointments', async () => {
    renderAppointments()
    expect(await screen.findAllByText('Подтвердить')).toHaveLength(2)
  })
})
