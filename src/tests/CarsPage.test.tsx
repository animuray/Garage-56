import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import CarsPage from '../pages/crm/CarsPage'

// vi.mock is hoisted — do NOT reference top-level consts inside the factory
vi.mock('../api', () => ({
  api: {
    getCarBrands: vi.fn().mockResolvedValue([
      { id: 1, name: 'Toyota', image_url: null },
      { id: 2, name: 'BMW', image_url: null },
    ]),
    getAppointments: vi.fn().mockResolvedValue([]),
    getClients: vi.fn().mockResolvedValue([
      {
        id: '1', name: 'Алексей Иванов', phone: '+7777', email: '',
        visitCount: 2, isRegular: false, createdAt: '', totalSpent: 0,
        cars: [{
          id: '10', make: 'Toyota', model: 'Camry', year: 2021,
          engineType: 'gasoline', engineVolume: 2.5,
          licensePlate: 'A001AA01', mileage: 55000, serviceHistory: [],
        }],
      },
      {
        id: '2', name: 'Гульнара Абенова', phone: '+7778', email: '',
        visitCount: 1, isRegular: false, createdAt: '', totalSpent: 0,
        cars: [{
          id: '11', make: 'BMW', model: 'X5', year: 2020,
          engineType: 'diesel', engineVolume: 3.0,
          licensePlate: 'B002BB01', mileage: 30000, serviceHistory: [],
        }],
      },
    ]),
    getCorporate: vi.fn().mockResolvedValue([]),
    getWarehouse: vi.fn().mockResolvedValue([]),
    getEmployees: vi.fn().mockResolvedValue([]),
  },
}))

function renderCars() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <CarsPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('CarsPage', () => {
  beforeEach(() => { localStorage.setItem('token', 'test-token') })
  afterEach(() => { localStorage.clear() })

  it('renders page title', () => {
    renderCars()
    expect(screen.getByText('Автомобили')).toBeInTheDocument()
  })

  it('has search input', () => {
    renderCars()
    expect(screen.getByPlaceholderText('Марка, модель, гос. номер, VIN, владелец...')).toBeInTheDocument()
  })

  it('shows car list from context', async () => {
    renderCars()
    expect(await screen.findByText(/Toyota/)).toBeInTheDocument()
    expect(await screen.findByText(/BMW/)).toBeInTheDocument()
  })

  it('shows license plates', async () => {
    renderCars()
    expect(await screen.findByText('A001AA01')).toBeInTheDocument()
    expect(await screen.findByText('B002BB01')).toBeInTheDocument()
  })

  it('shows "Добавить" button', () => {
    renderCars()
    expect(screen.getByText('Добавить')).toBeInTheDocument()
  })

  it('shows table headers', async () => {
    renderCars()
    await screen.findByText(/Toyota/)
    expect(screen.getByText('Автомобиль')).toBeInTheDocument()
    expect(screen.getByText('Гос. номер')).toBeInTheDocument()
    expect(screen.getByText('Пробег')).toBeInTheDocument()
    expect(screen.getByText('Владелец')).toBeInTheDocument()
  })

  it('filters cars by search query', async () => {
    renderCars()
    await screen.findByText(/Toyota/)
    const searchInput = screen.getByPlaceholderText('Марка, модель, гос. номер, VIN, владелец...')
    fireEvent.change(searchInput, { target: { value: 'BMW' } })
    await waitFor(() => {
      expect(screen.queryByText(/Toyota.*Camry|Camry.*Toyota/)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/BMW.*X5|X5.*BMW/)).toBeInTheDocument()
  })

  it('filters cars by license plate', async () => {
    renderCars()
    await screen.findByText('A001AA01')
    const searchInput = screen.getByPlaceholderText('Марка, модель, гос. номер, VIN, владелец...')
    fireEvent.change(searchInput, { target: { value: 'B002' } })
    await waitFor(() => {
      expect(screen.queryByText('A001AA01')).not.toBeInTheDocument()
    })
    expect(screen.getByText('B002BB01')).toBeInTheDocument()
  })

  it('filters cars by owner name', async () => {
    renderCars()
    await screen.findByText(/Toyota/)
    const searchInput = screen.getByPlaceholderText('Марка, модель, гос. номер, VIN, владелец...')
    fireEvent.change(searchInput, { target: { value: 'Алексей' } })
    await waitFor(() => {
      expect(screen.queryByText(/BMW.*X5|X5.*BMW/)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/Toyota.*Camry|Camry.*Toyota/)).toBeInTheDocument()
  })

  it('shows empty state message when no cars match search', async () => {
    renderCars()
    await screen.findByText(/Toyota/)
    const searchInput = screen.getByPlaceholderText('Марка, модель, гос. номер, VIN, владелец...')
    fireEvent.change(searchInput, { target: { value: 'xxxxnotfound' } })
    await waitFor(() => {
      expect(screen.getByText('Автомобилей не найдено')).toBeInTheDocument()
    })
  })
})
