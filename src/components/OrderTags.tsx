import { Building2, Globe } from 'lucide-react'
import type { Appointment } from '../types'
import { SplitBadge } from './ui'

/**
 * The tag next to the client's name in every order list.
 *  - an order from a taxi fleet ALWAYS shows «от таксопарка» (no "new" wording, it is simply what the order is);
 *    a small pulsing dot marks it while it is still unseen
 *  - a brand-new booking from the public site shows «НОВАЯ · с сайта» until the page is left
 *  - everything else: no tag
 */
export function OrderTag({ apt, isNew = false }: { apt: Pick<Appointment, 'corporateId' | 'source'>; isNew?: boolean }) {
  if (apt.corporateId) {
    return (
      <span data-testid="taxi-tag"
        className="inline-flex items-center gap-1.5 h-5 px-2 rounded-md border text-[11px] font-semibold leading-none whitespace-nowrap shrink-0 text-orange-300 bg-orange-500/15 border-orange-500/40">
        <Building2 size={11} />
        от таксопарка
        {isNew && (
          <span className="relative flex h-1.5 w-1.5" title="Ещё не просмотрена" data-testid="taxi-tag-dot">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
          </span>
        )}
      </span>
    )
  }
  if (isNew && apt.source === 'site') {
    return <SplitBadge label="Новая" tone="orange" icon={<Globe size={11} />}>с сайта</SplitBadge>
  }
  return null
}
