import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import DashboardPage from '../pages/crm/DashboardPage'

vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}))

vi.mock('../api', () => {
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().split('T')[0]
  return {
    api: {
      getAppointments: vi.fn().mockResolvedValue([
        { id: '1', date: today, time: '09:00', clientName: 'Алексей Иванов', clientPhone: '+79001111111', carMake: 'Toyota', carModel: 'Camry', carYear: 2020, licensePlate: 'A001AA', services: [], status: 'pending', total: 5000, createdAt: '', mileage: 0, engineType: 'Бензин', engineVolume: 2.0 },
        { id: '2', date: today, time: '10:00', clientName: 'Гульнара Абенова', clientPhone: '+79002222222', carMake: 'BMW', carModel: 'X5', carYear: 2021, licensePlate: 'B002BB', services: [], status: 'completed', total: 8000, createdAt: '', mileage: 0, engineType: 'Бензин', engineVolume: 3.0 },
      ]),
      getClients: vi.fn().mockResolvedValue([]),
      getCorporate: vi.fn().mockResolvedValue([]),
      getWarehouse: vi.fn().mockResolvedValue([]),
      getEmployees: vi.fn().mockResolvedValue([]),
      getCarBrands: vi.fn().mockResolvedValue([]),
      getDashboard: vi.fn().mockResolvedValue({
        newClientsToday: 2,
        oilUsedToday: 4.5,
        avgCheckToday: 6500,
        dailyRevenue: 13000,
        weeklyRevenue: [],
        popularServices: [{ name: 'Замена масла', count: 5, percent: 100 }],
        oilBrands: [{ name: 'Mobil 1', liters: 4.5 }],
      }),
    },
  }
})

function renderDashboard() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <DashboardPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => { localStorage.setItem('token', 'test-token') })
  afterEach(() => { localStorage.clear() })

  it('renders dashboard title', () => {
    renderDashboard()
    expect(screen.getByText('Дашборд')).toBeInTheDocument()
  })

  it('renders today stat cards', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Записей')).toBeInTheDocument()
      expect(screen.getAllByText('Выполнено').length).toBeGreaterThan(0)
      expect(screen.getByText('Ожидают')).toBeInTheDocument()
      expect(screen.getByText('Доход')).toBeInTheDocument()
      expect(screen.getByText('Новых клиентов')).toBeInTheDocument()
    })
  })

  it('renders appointments table header', async () => {
    renderDashboard()
    expect(await screen.findByText(/Записи —/)).toBeInTheDocument()
  })

  it('renders appointment times for today', async () => {
    renderDashboard()
    expect(await screen.findByText('09:00')).toBeInTheDocument()
    expect(await screen.findByText('10:00')).toBeInTheDocument()
  })

  it('renders popular services section', async () => {
    renderDashboard()
    expect(await screen.findByText('Популярные услуги')).toBeInTheDocument()
  })

  it('shows All records link', () => {
    renderDashboard()
    expect(screen.getByText('Все записи →')).toBeInTheDocument()
  })
})
