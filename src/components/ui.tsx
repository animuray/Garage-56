import type { ReactNode } from 'react'

// Small shared pieces so the same thing always looks the same:
//   typography — 14px body (text-sm), 12px secondary (text-xs), 11px uppercase labels (chips, counters, captions)
//   chips / counters — one height (20px), one text size (11px), one set of colours

export type Tone = 'orange' | 'green' | 'red' | 'gray'   // no blue: the CRM's accent is orange

const TONE: Record<Tone, string> = {
  orange: 'text-orange-300 bg-orange-500/10 border-orange-500/25',
  green: 'text-green-400 bg-green-500/10 border-green-500/25',
  red: 'text-red-400 bg-red-500/10 border-red-500/25',
  gray: 'text-gray-400 bg-[#1a1a1a] border-[#2a2a2a]',
}

/** A small status / label chip. */
export function Badge({ tone = 'gray', icon, children, className = '' }: {
  tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-md border text-[11px] font-semibold leading-none whitespace-nowrap shrink-0 ${TONE[tone]} ${className}`}>
      {icon}{children}
    </span>
  )
}

/** Two-part tag: a solid label on the left ("НОВАЯ") and a tinted description on the right. */
export function SplitBadge({ label, tone = 'orange', icon, children }: {
  label: string; tone?: Tone; icon?: ReactNode; children: ReactNode
}) {
  return (
    <span className={`inline-flex items-stretch h-5 rounded-md border overflow-hidden text-[11px] font-semibold leading-none whitespace-nowrap shrink-0 ${TONE[tone]}`}>
      <span className="flex items-center px-1.5 bg-orange-500 text-white uppercase tracking-wide">{label}</span>
      <span className="flex items-center gap-1 px-2">{icon}{children}</span>
    </span>
  )
}

/**
 * A round number badge (sidebar counters, tab counters). `tone` orange = "needs attention", gray = just a number;
 * `active` is for a counter sitting on a selected (orange) tab.
 */
export function Counter({ children, tone = 'orange', active = false, className = '' }: {
  children: ReactNode; tone?: 'orange' | 'gray'; active?: boolean; className?: string
}) {
  const colour = tone === 'orange'
    ? (active ? 'bg-white text-orange-600' : 'bg-orange-500 text-white')
    : (active ? 'bg-white/25 text-white' : 'bg-[#2a2a2a] text-gray-300')
  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-none shrink-0 ${colour} ${className}`}>
      {children}
    </span>
  )
}

/** Small uppercase caption above a value ("ПРИЧИНА"). */
export const Caption = ({ children }: { children: ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{children}</div>
)
