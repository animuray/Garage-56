import { describe, it, expect } from 'vitest'
import { calcOrderTotal, formatMoney } from '../utils/pricing'

describe('calcOrderTotal', () => {
  it('adds oil (liters × price per liter) to the price of the services', () => {
    const r = calcOrderTotal({ 'Замена масла': '18000', 'Воздушный фильтр': '2000' }, { price: 3000 }, 4.5)
    expect(r.servicesTotal).toBe(20000)
    expect(r.pricePerLiter).toBe(3000)
    expect(r.oilCost).toBe(13500)
    expect(r.total).toBe(33500)
  })

  it('has no oil part until oil and liters are chosen', () => {
    expect(calcOrderTotal({ a: '1000' }, undefined, 4).total).toBe(1000)
    expect(calcOrderTotal({ a: '1000' }, { price: 3000 }, 0).total).toBe(1000)
  })

  it('treats empty / invalid service prices as zero', () => {
    expect(calcOrderTotal({ a: '', b: 'abc', c: 500 }, undefined, 0).servicesTotal).toBe(500)
  })

  it('does not accumulate floating point noise', () => {
    expect(calcOrderTotal({}, { price: 2999.99 }, 4.3).oilCost).toBe(12899.96)
  })

  it('an oil without a price adds nothing', () => {
    const r = calcOrderTotal({ a: '1000' }, { price: 0 }, 4)
    expect(r.oilCost).toBe(0)
    expect(r.total).toBe(1000)
  })
})

describe('formatMoney', () => {
  it('formats tenge with a thousands separator', () => {
    expect(formatMoney(31500).replace(/\s/g, ' ')).toBe('31 500 ₸')
  })
})
