import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import BookingPage from '../pages/public/BookingPage'

function renderBooking() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <BookingPage />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('BookingPage', () => {
  it('renders booking wizard title', () => {
    renderBooking()
    expect(screen.getByText('ОНЛАЙН-ЗАПИСЬ')).toBeInTheDocument()
  })

  it('renders 4 step labels', () => {
    renderBooking()
    expect(screen.getByText('Дата и время')).toBeInTheDocument()
    expect(screen.getByText('Автомобиль')).toBeInTheDocument()
    expect(screen.getByText('Услуги')).toBeInTheDocument()
    expect(screen.getByText('Контакты')).toBeInTheDocument()
  })

  it('shows step 1: date selection', () => {
    renderBooking()
    expect(screen.getByText('1. Выберите дату и время')).toBeInTheDocument()
  })

  it('Continue button is disabled when no date/time selected', () => {
    renderBooking()
    const btn = screen.getByText('Продолжить')
    expect(btn).toBeDisabled()
  })

  it('renders date buttons for next 14 days', () => {
    renderBooking()
    // Should have multiple date buttons
    const dateButtons = screen.getAllByRole('button').filter(b =>
      b.textContent?.match(/\d+\s+[а-яё]+/i)
    )
    expect(dateButtons.length).toBeGreaterThan(0)
  })
})
