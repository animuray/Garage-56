import type { Appointment } from '../types'

// How an order row looks in the lists (Appointments, Dashboard, Master):
//  - on hover EVERY order is highlighted in the same orange;
//  - an order from a taxi fleet always carries a soft orange background (and a "от таксопарка" tag, see OrderTags),
//    so it stands out from regular clients' orders at a glance.
// Full class names are written out so Tailwind's JIT picks them up.
const HOVER = 'hover:bg-orange-500/10 hover:border-orange-500/20'
const TAXI_TINT = 'bg-orange-500/[0.05]'

export const appointmentRowHover = (_apt?: Pick<Appointment, 'corporateId'>) => HOVER

export const appointmentRowTint = (apt: Pick<Appointment, 'corporateId'>) => (apt.corporateId ? TAXI_TINT : '')

/** hover + the permanent tint for taxi fleet orders */
export const appointmentRowClass = (apt: Pick<Appointment, 'corporateId'>) =>
  [HOVER, appointmentRowTint(apt)].filter(Boolean).join(' ')
