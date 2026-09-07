import { useState, useCallback } from 'react'
import { detectPlate } from '../utils/plateDetector'

const CYR_TO_LAT: Record<string, string> = {
  'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H',
  'О':'O','Р':'P','С':'C','Т':'T','У':'Y','Х':'X',
}

interface PlateInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

export function PlateInput({ value, onChange, required, className }: PlateInputProps) {
  const [touched, setTouched] = useState(false)

  const result = value.trim() ? detectPlate(value) : null

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
      .toUpperCase()
      .split('')
      .map(ch => CYR_TO_LAT[ch] ?? ch)
      .filter(ch => /[A-Z0-9]/.test(ch))
      .join('')
      .slice(0, 10)
    onChange(raw)
  }, [onChange])

  const handleBlur = useCallback(() => setTouched(true), [])

  const flags = result
    ? result.exact.length > 0
      ? result.exact
      : result.candidates
    : []

  const showError = touched && result?.invalid

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-gray-400 font-medium">
          Гос. номер {required && <span className="text-orange-500">*</span>}
        </label>
        {flags.length > 0 && (
          <div className="flex items-center gap-1">
            {flags.map(c => (
              <img
                key={c.code}
                src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`}
                srcSet={`https://flagcdn.com/40x30/${c.code.toLowerCase()}.png 2x`}
                alt={c.name}
                title={c.name}
                className="h-3.5 rounded-sm"
              />
            ))}
          </div>
        )}
      </div>
      <input
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`input-field font-mono tracking-widest uppercase ${showError ? 'border-red-500/60' : ''} ${className ?? ''}`}
        placeholder="A 001 AA 01"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {showError && (
        <p className="text-red-400 text-xs mt-1">Неверный формат</p>
      )}
    </div>
  )
}
