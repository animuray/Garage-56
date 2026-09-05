import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HomePage from '../pages/public/HomePage'

vi.mock('../api', () => ({
  api: {
    getWhyBlocks: vi.fn().mockResolvedValue([]),
    getPublicInfo: vi.fn().mockResolvedValue({}),
    getServices: vi.fn().mockResolvedValue([
      { id: '1', name: 'Замена масла двигателя', description: '', price: 3000, imageUrl: '', isActive: true },
      { id: '2', name: 'Замена масла АКПП', description: '', price: 3500, imageUrl: '', isActive: true },
      { id: '3', name: 'Замена масла МКПП', description: '', price: 2500, imageUrl: '', isActive: true },
      { id: '4', name: 'Замена масла в редукторе', description: '', price: 2000, imageUrl: '', isActive: true },
      { id: '5', name: 'Замена воздушного фильтра', description: '', price: 1500, imageUrl: '', isActive: true },
      { id: '6', name: 'Замена салонного фильтра', description: '', price: 1500, imageUrl: '', isActive: true },
      { id: '7', name: 'Замена топливного фильтра', description: '', price: 2000, imageUrl: '', isActive: true },
      { id: '8', name: 'Заправка кондиционера', description: '', price: 5000, imageUrl: '', isActive: true },
    ]),
  },
}))

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('HomePage', () => {
  it('renders hero section with headline', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText(/ПРОФЕССИОНАЛЬНАЯ/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ЗАМЕНА МАСЛА/i).length).toBeGreaterThan(0)
  })

  it('renders all 8 service cards', async () => {
    renderWithRouter(<HomePage />)
    expect(await screen.findByText('Замена масла двигателя')).toBeInTheDocument()
    expect(await screen.findByText('Замена масла АКПП')).toBeInTheDocument()
    expect(await screen.findByText('Замена масла МКПП')).toBeInTheDocument()
    expect(await screen.findByText('Замена масла в редукторе')).toBeInTheDocument()
    expect(await screen.findByText('Замена воздушного фильтра')).toBeInTheDocument()
    expect(await screen.findByText('Замена салонного фильтра')).toBeInTheDocument()
    expect(await screen.findByText('Замена топливного фильтра')).toBeInTheDocument()
    expect(await screen.findByText('Заправка кондиционера')).toBeInTheDocument()
  })

  it('renders Why section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText(/ПОЧЕМУ ВЫБИРАЮТ GARAGE 56/i)).toBeInTheDocument()
  })

  it('renders contacts section', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getByText(/КАК НАС НАЙТИ/i)).toBeInTheDocument()
    expect(screen.getAllByText(/г\. Алматы/i).length).toBeGreaterThan(0)
  })

  it('renders booking CTA button', () => {
    renderWithRouter(<HomePage />)
    expect(screen.getAllByText(/Онлайн-запись|Записаться/i).length).toBeGreaterThan(0)
  })
})
