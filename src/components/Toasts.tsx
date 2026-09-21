import type { ReactNode } from 'react'
import { X, Building2, Globe, CalendarX, Archive, ArchiveRestore, UserPlus, Link2, Bell } from 'lucide-react'
import type { LiveEvent } from '../utils/liveEvents'

// Pop-up notifications in the bottom-right corner of the CRM. They appear the moment the server reports an event
// (see utils/liveEvents), on any CRM page, and need no browser permission.

export interface ToastItem {
  key: string
  type: string
  title: string
  text: string
  url: string
  icon: ReactNode
  accent: string      // Tailwind classes for the icon tile
  bar: string         // Tailwind class for the left accent line
}

const ICON = 18
const ORANGE = { accent: 'bg-orange-500/15 border-orange-500/30 text-orange-400', bar: 'border-l-orange-500' }
const NEUTRAL = { accent: 'bg-white/5 border-white/15 text-gray-200', bar: 'border-l-gray-400' }   // site bookings, new clients
const GREEN = { accent: 'bg-green-500/15 border-green-500/30 text-green-400', bar: 'border-l-green-500' }
const RED = { accent: 'bg-red-500/15 border-red-500/30 text-red-400', bar: 'border-l-red-500' }

/** Turns a server event into a toast (or null for events that are only silent "reload" signals). */
export function toastFromEvent(e: LiveEvent): ToastItem | null {
  const key = `${e.type}:${e.bookingId ?? e.requestId ?? e.clientId ?? e.ts}`
  const base = { key, type: e.type, title: e.title ?? '', text: e.body ?? '', url: e.url ?? '/crm/appointments' }
  switch (e.type) {
    case 'booking':
      return { ...base, ...(e.source === 'telegram' ? ORANGE : NEUTRAL),
        icon: e.source === 'telegram' ? <Building2 size={ICON} /> : <Globe size={ICON} /> }
    case 'booking_cancelled':
      return { ...base, ...RED, icon: <CalendarX size={ICON} /> }
    case 'car_request':
      return e.requestKind === 'restore'
        ? { ...base, ...GREEN, icon: <ArchiveRestore size={ICON} /> }
        : { ...base, ...ORANGE, icon: <Archive size={ICON} /> }
    case 'client':
      return { ...base, ...NEUTRAL, icon: <UserPlus size={ICON} /> }
    case 'bot_linked':
      return { ...base, ...GREEN, icon: <Link2 size={ICON} /> }
    default:
      return e.title ? { ...base, ...ORANGE, icon: <Bell size={ICON} /> } : null
  }
}

export function Toasts({ items, onOpen, onClose }: {
  items: ToastItem[]
  onOpen: (t: ToastItem) => void
  onClose: (key: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div data-testid="toast-stack" className="fixed bottom-4 right-4 z-[150] flex flex-col gap-2.5 w-[min(92vw,380px)]">
      {items.map(t => (
        <div key={t.key} role="status" data-testid="toast"
          className={`bg-[#1a1a1a] border border-[#2a2a2a] border-l-2 ${t.bar} rounded-xl shadow-2xl shadow-black/60 p-3.5 flex items-start gap-3`}>
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${t.accent}`}>{t.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white leading-snug">{t.title}</div>
            {t.text && <div className="text-xs text-gray-400 mt-0.5 leading-snug break-words">{t.text}</div>}
            <button onClick={() => onOpen(t)} className="mt-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors">
              Открыть →
            </button>
          </div>
          <button onClick={() => onClose(t.key)} aria-label="Закрыть" className="text-gray-500 hover:text-white shrink-0 -mt-0.5"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
