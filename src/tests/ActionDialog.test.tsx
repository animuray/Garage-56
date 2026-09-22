import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActionDialog, CarSummary } from '../components/ActionDialog'

const base = { icon: <span>i</span>, title: 'Удалить автомобиль?', confirmLabel: 'Удалить в архив' }

describe('ActionDialog', () => {
  it('shows title, subtitle, consequences and the car summary', () => {
    render(
      <ActionDialog {...base} subtitle="Запрос от «Такси»" onConfirm={() => {}} onCancel={() => {}}
        points={[{ kind: 'keep', text: 'История сохранится' }, { kind: 'warn', text: 'Осторожно' }]}>
        <CarSummary plate="123ABC02" label="Toyota Camry" lines={['Иван · 21.09.2026']} />
      </ActionDialog>
    )
    expect(screen.getByText('Удалить автомобиль?')).toBeInTheDocument()
    expect(screen.getByText('Запрос от «Такси»')).toBeInTheDocument()
    expect(screen.getByText('История сохранится')).toBeInTheDocument()
    expect(screen.getByText('123ABC02')).toBeInTheDocument()
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument()
    expect(screen.getByText('Иван · 21.09.2026')).toBeInTheDocument()
  })

  it('confirms and cancels', async () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ActionDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Удалить в архив'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(''))
    fireEvent.click(screen.getByText('Отмена'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('closes on Escape, but NOT on a misclick outside the dialog (only the × / Cancel button do)', () => {
    const onCancel = vi.fn()
    const { container } = render(<ActionDialog {...base} onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(container.firstChild as Element)   // the backdrop — must not close the dialog
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('passes the trimmed comment of the textarea variant to onConfirm', async () => {
    const onConfirm = vi.fn()
    render(<ActionDialog {...base} confirmLabel="Отклонить запрос" onConfirm={onConfirm} onCancel={() => {}}
      textarea={{ label: 'Комментарий', placeholder: 'Например…', hint: 'Клиент получит его в Telegram' }} />)
    expect(screen.getByText('Клиент получит его в Telegram')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Например…'), { target: { value: '  Есть незавершённые записи ' } })
    fireEvent.click(screen.getByText('Отклонить запрос'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Есть незавершённые записи'))
  })

  it('keeps the dialog open and shows the error when the action fails, then allows retry', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('Запрос уже обработан')).mockResolvedValueOnce(undefined)
    const onCancel = vi.fn()
    render(<ActionDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Удалить в архив'))
    expect(await screen.findByText('Запрос уже обработан')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Удалить в архив'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Запрос уже обработан')).not.toBeInTheDocument())
  })

  it('ignores Escape while the action is running', async () => {
    let finish: () => void = () => {}
    const onConfirm = vi.fn(() => new Promise<void>(r => { finish = r }))
    const onCancel = vi.fn()
    render(<ActionDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Удалить в архив'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
    finish()
  })
})
