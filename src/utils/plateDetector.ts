export interface CountryMatch {
  code: string
  name: string
  flag: string
}

export interface PlateDetectResult {
  candidates: CountryMatch[]  // страны, чей формат ещё может подойти
  exact: CountryMatch[]       // страны, чей формат совпал точно
  valid: boolean              // есть хотя бы один точный формат
  invalid: boolean            // ввод достаточно длинный, но ни одна маска не подходит
}

// Кириллические двойники → латиница
const CYR_TO_LAT: Record<string, string> = {
  'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H',
  'О':'O','Р':'P','С':'C','Т':'T','У':'Y','Х':'X',
}

// L = буква, D = цифра. Дефисы и пробелы игнорируются при нормализации.
const COUNTRIES: Array<{ code: string; name: string; flag: string; patterns: string[] }> = [
  { code: 'RU', name: 'Россия',      flag: '🇷🇺', patterns: ['LDDDLLDD', 'LDDDLLDDD'] },
  { code: 'KZ', name: 'Казахстан',   flag: '🇰🇿', patterns: ['DDDLLLDD', 'DDDLLDD'] },
  { code: 'BY', name: 'Беларусь',    flag: '🇧🇾', patterns: ['DDDDLLD', 'LLDDDDD', 'LDDDDLD'] },
  { code: 'AM', name: 'Армения',     flag: '🇦🇲', patterns: ['DDLLDDD', 'DDDLLDD'] },
  { code: 'AZ', name: 'Азербайджан', flag: '🇦🇿', patterns: ['DDLLDDD'] },
  { code: 'KG', name: 'Кыргызстан',  flag: '🇰🇬', patterns: ['DDLLDDDLLL'] },
  { code: 'TJ', name: 'Таджикистан', flag: '🇹🇯', patterns: ['DDDDLLDD', 'DDDLLDD', 'DDLLDDDD'] },
  { code: 'UZ', name: 'Узбекистан',  flag: '🇺🇿', patterns: ['DDLDDDLL', 'LDDDLLDD', 'DDDDDLLL'] },
]

function normalizePlate(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[\s\-]/g, '')
    .split('')
    .map(ch => CYR_TO_LAT[ch] ?? ch)
    .join('')
}

function toMask(str: string): string {
  return str.split('').map(ch => (/[0-9]/.test(ch) ? 'D' : 'L')).join('')
}

export function detectPlate(rawInput: string): PlateDetectResult {
  const clean = normalizePlate(rawInput)
  if (!clean) return { candidates: [], exact: [], valid: false, invalid: false }

  const mask = toMask(clean)

  const candidates = COUNTRIES.filter(c =>
    c.patterns.some(p => p.startsWith(mask) || mask.startsWith(p))
  )

  const exact = COUNTRIES.filter(c => c.patterns.includes(mask))

  return {
    candidates,
    exact,
    valid: exact.length > 0,
    invalid: clean.length >= 5 && candidates.length === 0,
  }
}
