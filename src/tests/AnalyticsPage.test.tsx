import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import AnalyticsPage from '../pages/crm/AnalyticsPage'

// Mock recharts — chart components don't render in jsdom
vi.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Area: () => null,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

const MOCK_ANALYTICS = {
  summary: {
    totalRevenue: 500000,
    avgCheck: 12500,
    totalOrders: 40,
    totalClients: 30,
    newClients: 5,
    repeatClients: 25,
    oilUsed: 120,
    filtersChanged: 38,
  },
  monthlyRevenue: [{ month: 'Авг', revenue: 500000 }],
  weeklyRevenue: [{ day: 'Пн', orders: 5, revenue: 62500 }],
  popularServices: [
    { name: 'Замена масла', count: 25, percent: 62.5 },
    { name: 'Диагностика', count: 10, percent: 25 },
  ],
  popularMakes: [{ name: 'Toyota', count: 15 }],
  oilBrands: [{ name: 'Mobil 1', liters: 60 }],
  masters: [{ name: 'Мастер Алибек', orders: 20 }],
}

const mockGetAnalytics = vi.fn()

vi.mock('../api', () => ({
  api: {
    getAnalytics: (...args: any[]) => mockGetAnalytics(...args),
    getAppointments: vi.fn().mockResolvedValue([]),
    getClients: vi.fn().mockResolvedValue([]),
    getCorporate: vi.fn().mockResolvedValue([]),
    getWarehouse: vi.fn().mockResolvedValue([]),
    getEmployees: vi.fn().mockResolvedValue([]),
  },
}))

function renderAnalytics() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AnalyticsPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('AnalyticsPage', () => {
  beforeEach(() => { localStorage.setItem('token', 'test-token') })
  afterEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('shows loading indicator initially', () => {
    mockGetAnalytics.mockReturnValue(new Promise(() => {})) // never resolves
    renderAnalytics()
    // While loading, main content not yet shown — stat cards absent
    expect(screen.queryByText('Общая выручка')).not.toBeInTheDocument()
  })

  it('shows error message when API fails', async () => {
    mockGetAnalytics.mockRejectedValue(new Error('Сервер недоступен'))
    renderAnalytics()
    await waitFor(() => {
      expect(screen.getByText(/Сервер недоступен|Не удалось загрузить данные/)).toBeInTheDocument()
    })
  })

  it('renders summary stat cards on successful load', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    expect(await screen.findByText('Общая выручка')).toBeInTheDocument()
    expect(screen.getByText('Средний чек')).toBeInTheDocument()
    expect(screen.getByText('Выполнено заказов')).toBeInTheDocument()
  })

  it('displays correct revenue value', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    await screen.findByText('Общая выручка')
    // 500000 formatted as "500 000"
    expect(screen.getByText(/500\s*000/)).toBeInTheDocument()
  })

  it('renders popular services section', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    expect(await screen.findByText('Популярные услуги')).toBeInTheDocument()
    expect(await screen.findByText('Замена масла')).toBeInTheDocument()
  })

  it('renders oil brands section', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    expect(await screen.findByText('Расход масел')).toBeInTheDocument()
    expect(await screen.findByText('Mobil 1')).toBeInTheDocument()
  })

  it('renders masters section', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    expect(await screen.findByText('Загрузка мастеров')).toBeInTheDocument()
    expect(await screen.findByText('Мастер Алибек')).toBeInTheDocument()
  })

  it('renders page title and date range header', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    expect(await screen.findByText('Аналитика')).toBeInTheDocument()
  })

  it('renders charts container', async () => {
    mockGetAnalytics.mockResolvedValue(MOCK_ANALYTICS)
    renderAnalytics()
    await screen.findByText('Общая выручка')
    expect(screen.getAllByTestId('area-chart').length + screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0)
  })
})
