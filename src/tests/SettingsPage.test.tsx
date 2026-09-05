import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import SettingsPage from '../pages/crm/SettingsPage'

vi.mock('../api', () => ({
  api: {
    getSettings: vi.fn().mockResolvedValue({
      name: 'Garage 56',
      phone: '+7 (701) 000-00-00',
      whatsapp: '',
      address: '',
      workdayStart: '09:00',
      workdayEnd: '18:00',
      weekendStart: '10:00',
      weekendEnd: '16:00',
      slotDuration: '60',
      maxSlots: '8',
      bookingDaysAhead: '14',
      regular_client_threshold: '3',
    }),
    updateSettings: vi.fn().mockResolvedValue({}),
    getCarBrands: vi.fn().mockResolvedValue([]),
    getAppointments: vi.fn().mockResolvedValue([]),
    getClients: vi.fn().mockResolvedValue([]),
    getCorporate: vi.fn().mockResolvedValue([]),
    getWarehouse: vi.fn().mockResolvedValue([]),
    getEmployees: vi.fn().mockResolvedValue([]),
    getWhyBlocks: vi.fn().mockResolvedValue([]),
  },
}))

function renderSettings() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <SettingsPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => { localStorage.setItem('token', 'test-token') })
  afterEach(() => { localStorage.clear() })

  it('renders page title', async () => {
    renderSettings()
    expect(await screen.findByText('Настройки')).toBeInTheDocument()
  })

  it('renders all section headers', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Информация о сервисе')).toBeInTheDocument()
      expect(screen.getByText('Контакты')).toBeInTheDocument()
      expect(screen.getByText('Часы работы')).toBeInTheDocument()
      expect(screen.getByText('Онлайн-запись')).toBeInTheDocument()
    })
  })

  it('section content is hidden by default (collapsed)', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Информация о сервисе')).toBeInTheDocument()
    })
    // Fields inside sections should not be visible until expanded
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument()
  })

  it('expands section when header is clicked', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Информация о сервисе')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Информация о сервисе'))
    await waitFor(() => {
      expect(screen.getByText('Название')).toBeInTheDocument()
    })
  })

  it('collapses section when header is clicked again', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Информация о сервисе')).toBeInTheDocument()
    })
    // Expand
    fireEvent.click(screen.getByText('Информация о сервисе'))
    await waitFor(() => {
      expect(screen.getByText('Название')).toBeInTheDocument()
    })
    // Collapse
    fireEvent.click(screen.getByText('Информация о сервисе'))
    await waitFor(() => {
      expect(screen.queryByText('Название')).not.toBeInTheDocument()
    })
  })

  it('expands Онлайн-запись section and shows slot duration input', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Онлайн-запись')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Онлайн-запись'))
    await waitFor(() => {
      expect(screen.getByText('Длительность слота (минут)')).toBeInTheDocument()
    })
  })

  it('expands Часы работы section and shows schedule labels', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Часы работы')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Часы работы'))
    await waitFor(() => {
      expect(screen.getByText(/Понедельник/)).toBeInTheDocument()
    })
  })

  it('renders Марки автомобилей section', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Марки автомобилей')).toBeInTheDocument()
    })
  })

  it('section header is a div not a button — no button nesting warning source', async () => {
    renderSettings()
    await waitFor(() => {
      expect(screen.getByText('Информация о сервисе')).toBeInTheDocument()
    })
    // The header containing the title should NOT be a <button>
    const header = screen.getByText('Информация о сервисе').closest('[class*="cursor-pointer"]')
    expect(header?.tagName).not.toBe('BUTTON')
  })
})
