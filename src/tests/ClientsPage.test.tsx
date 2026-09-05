import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import ClientsPage from '../pages/crm/ClientsPage'

// vi.mock is hoisted — do NOT reference top-level consts inside the factory
vi.mock('../api', () => ({
  api: {
    getClients: vi.fn().mockResolvedValue([
      {
        id: '1', name: 'Алексей Иванов', phone: '+77771111111', email: 'a@a.com',
        visitCount: 5, lastVisit: '2026-08-01', totalSpent: 25000, isRegular: true,
        notes: '', createdAt: '2026-01-01', cars: [],
      },
      {
        id: '2', name: 'Гульнара Абенова', phone: '+77772222222', email: '',
        visitCount: 1, lastVisit: '2026-07-01', totalSpent: 5000, isRegular: false,
        notes: '', createdAt: '2026-02-01', cars: [],
      },
      {
        id: '3', name: 'Николай Козлов', phone: '+77773333333', email: '',
        visitCount: 3, lastVisit: '2026-08-10', totalSpent: 15000, isRegular: true,
        notes: '', createdAt: '2026-03-01', cars: [],
      },
    ]),
    getCarBrands: vi.fn().mockResolvedValue([]),
    getAppointments: vi.fn().mockResolvedValue([]),
    getCorporate: vi.fn().mockResolvedValue([]),
    getWarehouse: vi.fn().mockResolvedValue([]),
    getEmployees: vi.fn().mockResolvedValue([]),
  },
}))

function renderClients() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <ClientsPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('ClientsPage', () => {
  beforeEach(() => { localStorage.setItem('token', 'test-token') })
  afterEach(() => { localStorage.clear() })

  it('renders page title', () => {
    renderClients()
    expect(screen.getByText('Клиенты')).toBeInTheDocument()
  })

  it('shows all clients after load', async () => {
    renderClients()
    expect(await screen.findByText('Алексей Иванов')).toBeInTheDocument()
    expect(await screen.findByText('Гульнара Абенова')).toBeInTheDocument()
    expect(await screen.findByText('Николай Козлов')).toBeInTheDocument()
  })

  it('shows client count summary', async () => {
    renderClients()
    await screen.findByText('Алексей Иванов')
    expect(screen.getByText('Всего клиентов')).toBeInTheDocument()
    expect(screen.getByText('Постоянных')).toBeInTheDocument()
  })

  it('shows total spent across all clients', async () => {
    renderClients()
    await screen.findByText('Алексей Иванов')
    // 25000 + 5000 + 15000 = 45000 ₸
    expect(screen.getByText(/45\s*000/)).toBeInTheDocument()
  })

  it('has search input', () => {
    renderClients()
    expect(screen.getByPlaceholderText('Имя, телефон, email...')).toBeInTheDocument()
  })

  it('has "Постоянные" filter button', () => {
    renderClients()
    expect(screen.getByText('Постоянные')).toBeInTheDocument()
  })

  it('has sort dropdown with default option', () => {
    renderClients()
    expect(screen.getByText('По дате добавления')).toBeInTheDocument()
  })

  it('renders table headers', async () => {
    renderClients()
    await screen.findByText('Алексей Иванов')
    expect(screen.getByText('Клиент')).toBeInTheDocument()
    expect(screen.getByText('Визиты')).toBeInTheDocument()
  })

  it('shows "Добавить" button', () => {
    renderClients()
    expect(screen.getByText('Добавить')).toBeInTheDocument()
  })

  it('opens new client modal on "Добавить" click', async () => {
    renderClients()
    fireEvent.click(screen.getByText('Добавить'))
    expect(await screen.findByText('Новый клиент')).toBeInTheDocument()
  })
})
