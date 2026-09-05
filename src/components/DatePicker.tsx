import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

interface Props {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  maxDate?: string // YYYY-MM-DD, disables days after this date
  minDate?: string // YYYY-MM-DD, disables days before this date
  triggerKey?: number // increment from parent to force-open the picker
}

export default function DatePicker({ value, onChange, className = '', placeholder = 'дд.мм.гггг', maxDate, minDate, triggerKey }: Props) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date())
  const ref = useRef<HTMLDivElement>(null)
  const prevTriggerKey = useRef(triggerKey ?? 0)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setOpenUp(rect.bottom + 280 > window.innerHeight)
      setAlignRight(rect.left + 256 > window.innerWidth)
    }
    setOpen(o => !o)
  }, [])

  useEffect(() => {
    if (value) setViewDate(new Date(value))
  }, [value])

  useEffect(() => {
    if (triggerKey !== undefined && triggerKey !== prevTriggerKey.current) {
      prevTriggerKey.current = triggerKey
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setOpenUp(rect.bottom + 280 > window.innerHeight)
        setAlignRight(rect.left + 256 > window.innerWidth)
      }
      setOpen(true)
    }
  }, [triggerKey])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)
  while (cells.length % 7 !== 0) cells.push(null)

  const selected = value ? new Date(value + 'T00:00:00') : null
  const _utc5 = new Date(Date.now() + 5 * 3600 * 1000)
  const todayY = _utc5.getUTCFullYear()
  const todayM = _utc5.getUTCMonth()
  const todayD = _utc5.getUTCDate()

  const maxDateObj = maxDate ? new Date(maxDate + 'T00:00:00') : null
  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null

  const isSelected = (day: number) =>
    !!selected && selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day

  const isToday = (day: number) =>
    todayY === year && todayM === month && todayD === day

  const isDisabled = (day: number) => {
    const d = new Date(year, month, day)
    if (maxDateObj && d > maxDateObj) return true
    if (minDateObj && d < minDateObj) return true
    return false
  }

  const selectDay = (day: number) => {
    if (isDisabled(day)) return
    const d = new Date(year, month, day)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  const displayValue = value ? value.split('-').reverse().join('.') : ''

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div
        onClick={handleOpen}
        className="input-field flex items-center gap-2 cursor-pointer select-none"
      >
        <span className={`flex-1 text-sm ${displayValue ? 'text-white' : 'text-gray-600'}`}>
          {displayValue || placeholder}
        </span>
        {value && (
          <button onClick={e => { e.stopPropagation(); onChange('') }} className="text-gray-500 hover:text-white">
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className={`absolute z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl p-4 w-64 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${alignRight ? 'right-0' : 'left-0'}`}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#2a2a2a] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-white text-sm font-medium">{MONTHS[month]} {year}</span>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#2a2a2a] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs text-gray-500 py-1 font-medium">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day ? (
                  <button
                    onClick={() => selectDay(day)}
                    disabled={isDisabled(day)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors
                      ${isDisabled(day)
                        ? 'text-gray-700 cursor-not-allowed'
                        : isSelected(day)
                          ? 'bg-orange-500 text-white'
                          : isToday(day)
                            ? 'border border-orange-500/40 text-orange-400 hover:bg-orange-500/20'
                            : 'text-gray-300 hover:bg-[#2a2a2a]'
                      }`}
                  >
                    {day}
                  </button>
                ) : <div className="w-8 h-8" />}
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[#2a2a2a] flex justify-between">
            <button onClick={() => onChange('')}
              className="text-xs text-gray-500 hover:text-white transition-colors">
              Очистить
            </button>
            <button onClick={() => { setViewDate(new Date(_utc5)); selectDay(todayD) }}
              className="text-xs text-orange-500 hover:text-orange-400 transition-colors">
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
