import { describe, it, expect } from 'vitest'
import { appointmentRowClass, appointmentRowHover, appointmentRowTint } from '../utils/appointmentStyle'
import type { Appointment } from '../types'

const apt = (extra: Partial<Appointment> = {}) => ({ id: '1', ...extra }) as Appointment

describe('appointment row styling', () => {
  it('every order has the same orange hover, whoever it is from', () => {
    for (const a of [apt(), apt({ corporateId: '7' }), apt({ source: 'site' }), apt({ source: 'telegram' })]) {
      expect(appointmentRowHover(a)).toBe('hover:bg-orange-500/10 hover:border-orange-500/20')
      expect(appointmentRowClass(a)).toContain('hover:bg-orange-500/10')
    }
  })

  it('only taxi fleet orders keep a permanent orange tint', () => {
    expect(appointmentRowTint(apt({ corporateId: '7' }))).toContain('bg-orange-500')
    expect(appointmentRowTint(apt())).toBe('')
    expect(appointmentRowTint(apt({ source: 'site' }))).toBe('')
  })

  it('no blue in any class', () => {
    for (const a of [apt(), apt({ corporateId: '7' })]) expect(appointmentRowClass(a)).not.toMatch(/sky|blue|cyan|indigo/)
  })
})
