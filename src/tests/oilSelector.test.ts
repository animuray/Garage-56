import { describe, it, expect } from 'vitest'
import { getEngineSpecs, getRecommendation } from '../data/oilSelector'

describe('getEngineSpecs', () => {
  it('returns engine specs for a known make/model', () => {
    const specs = getEngineSpecs('Toyota', 'Camry')
    expect(specs).toContain('2.0 (бензин)')
    expect(specs).toContain('2.5 (бензин)')
    expect(specs.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown make', () => {
    expect(getEngineSpecs('UnknownMake', 'SomeModel')).toEqual([])
  })

  it('returns empty array for unknown model within known make', () => {
    expect(getEngineSpecs('Toyota', 'UnknownModel')).toEqual([])
  })

  it('returns correct specs for BMW X5', () => {
    const specs = getEngineSpecs('BMW', 'X5')
    expect(specs).toContain('3.0 (бензин)')
    expect(specs).toContain('3.0d (дизель)')
  })

  it('returns correct specs for Kia Rio', () => {
    const specs = getEngineSpecs('Kia', 'Rio')
    expect(specs).toContain('1.4 (бензин)')
    expect(specs).toContain('1.6 (бензин)')
  })
})

describe('getRecommendation', () => {
  it('returns recommendation for Toyota Camry 2.5 (бензин)', () => {
    const rec = getRecommendation('Toyota', 'Camry', '2.5 (бензин)')
    expect(rec).not.toBeNull()
    expect(rec?.viscosity).toBe('5W-30')
    expect(rec?.volume).toBe(5.3)
    expect(rec?.oilFilter).toBe('MANN W712/95')
  })

  it('returns recommendation for BMW X5 3.0d (дизель)', () => {
    const rec = getRecommendation('BMW', 'X5', '3.0d (дизель)')
    expect(rec).not.toBeNull()
    expect(rec?.viscosity).toBe('5W-30')
    expect(rec?.oilType).toContain('LL-04')
  })

  it('returns null for unknown make', () => {
    expect(getRecommendation('Unknown', 'Model', '2.0 (бензин)')).toBeNull()
  })

  it('returns null for unknown engine on known make/model', () => {
    expect(getRecommendation('Toyota', 'Camry', '6.0 (бензин)')).toBeNull()
  })

  it('returns recommendation with airFilter when present', () => {
    const rec = getRecommendation('Toyota', 'Camry', '2.5 (бензин)')
    expect(rec?.airFilter).toBe('MANN C25114/1')
  })

  it('returns recommendation without airFilter when absent', () => {
    const rec = getRecommendation('Toyota', 'Camry', '2.0 (бензин)')
    expect(rec?.airFilter).toBeUndefined()
  })

  it('returns notes when present (Toyota Camry 2.0)', () => {
    const rec = getRecommendation('Toyota', 'Camry', '2.0 (бензин)')
    expect(rec?.notes).toContain('0W-20')
  })

  it('Hyundai Accent 1.4 returns correct volume', () => {
    const rec = getRecommendation('Hyundai', 'Accent', '1.4 (бензин)')
    expect(rec?.volume).toBe(3.3)
    expect(rec?.oilFilter).toBe('Knecht OC 123')
  })

  it('Toyota Land Cruiser diesel returns large volume', () => {
    const rec = getRecommendation('Toyota', 'Land Cruiser', '4.5 (дизель)')
    expect(rec?.volume).toBe(9.5)
    expect(rec?.viscosity).toBe('5W-40')
  })
})
