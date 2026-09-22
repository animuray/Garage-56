import { CarTaxiFront, Globe } from 'lucide-react'
import type { Appointment } from '../types'
import { SplitBadge } from './ui'

/**
 * A taxi-fleet order is always marked the same way, everywhere: a small taxi icon right before the
 * client's name — no text, no badge, so a row looks the same whether it is from a taxi fleet or not
 * (same height, same baseline), just with or without the icon. A pulsing dot on the icon marks it
 * unseen; it disappears once opened.
 */
export function TaxiMark({ apt, isNew = false }: { apt: Pick<Appointment, 'corporateId'>; isNew?: boolean }) {
  if (!apt.corporateId) return null
  return (
    <span data-testid="taxi-tag" title="Заказ от таксопарка" className="relative inline-flex items-center justify-center shrink-0">
      <CarTaxiFront size={15} className="text-orange-400" />
      {isNew && (
        <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5" data-testid="taxi-tag-dot" title="Ещё не просмотрена">
          <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
        </span>
      )}
    </span>
  )
}

/** A brand-new booking from the public site — the only case that still gets a text badge, shown after the name. */
export function OrderTag({ apt, isNew = false }: { apt: Pick<Appointment, 'source'>; isNew?: boolean }) {
  if (isNew && apt.source === 'site') {
    return <SplitBadge label="Новая" tone="orange" icon={<Globe size={11} />}>с сайта</SplitBadge>
  }
  return null
}
