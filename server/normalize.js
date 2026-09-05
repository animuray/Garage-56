// Phone and license plate normalization for client deduplication

// Cyrillic letters that look identical to Latin on RU/KZ plates
const CYRILLIC_TO_LATIN = {
  '\u0410': 'A', // А
  '\u0412': 'B', // В
  '\u0415': 'E', // Е
  '\u041A': 'K', // К
  '\u041C': 'M', // М
  '\u041D': 'H', // Н
  '\u041E': 'O', // О
  '\u0420': 'P', // Р
  '\u0421': 'C', // С
  '\u0422': 'T', // Т
  '\u0425': 'X', // Х
}

/**
 * Normalize phone to +7XXXXXXXXXX format.
 * Accepts any format: +7xxx, 8xxx, 7xxx, raw 10 digits, etc.
 * Returns null if too short to be a valid phone.
 */
function normalizePhone(phone) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  return '+7' + last10
}

/**
 * Normalize license plate: uppercase, replace look-alike Cyrillic with Latin,
 * strip spaces/hyphens. E.g. "а 123 вс 05" → "A123BC05"
 */
function normalizePlate(plate) {
  if (!plate) return null
  return plate
    .toUpperCase()
    .split('')
    .map(ch => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('')
    .replace(/[\s\-_]/g, '')
}

module.exports = { normalizePhone, normalizePlate }
