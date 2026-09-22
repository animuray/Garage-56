import { useEffect, useState, type ReactNode } from 'react'
import { X, Check, Info, AlertTriangle } from 'lucide-react'

type Tone = 'danger' | 'success' | 'neutral'

const TONE: Record<Tone, { tile: string; button: string }> = {
  danger: { tile: 'bg-red-500/15 border-red-500/30 text-red-400', button: 'bg-red-500 hover:bg-red-600' },
  success: { tile: 'bg-green-500/15 border-green-500/30 text-green-400', button: 'bg-green-600 hover:bg-green-700' },
  neutral: { tile: 'bg-orange-500/15 border-orange-500/30 text-orange-400', button: 'bg-orange-500 hover:bg-orange-600' },
}

export interface DialogPoint {
  text: string
  kind?: 'keep' | 'warn' | 'info'   // keep = "this stays", warn = "watch out", info = neutral note
}

/** Summary card of a car (plate + name + optional lines) used inside dialogs. */
export function CarSummary({ plate, label, lines }: { plate: string; label: string; lines?: (ReactNode)[] }) {
  return (
    <div className="flex items-start gap-3 bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
      <div className="px-2.5 py-1.5 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-sm tracking-wide shrink-0">
        {plate}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm font-medium truncate">{label}</div>
        {lines?.filter(Boolean).map((l, i) => <div key={i} className="text-gray-500 text-xs mt-0.5">{l}</div>)}
      </div>
    </div>
  )
}

/**
 * A confirmation dialog in the CRM's own style (replaces the browser's confirm()/prompt()).
 * `onConfirm` may be async and may throw: the message is shown inside the dialog and it stays open.
 */
export function ActionDialog({
  tone = 'neutral', icon, title, subtitle, children, points, textarea,
  confirmLabel, cancelLabel = 'Отмена', onConfirm, onCancel,
}: {
  tone?: Tone
  icon: ReactNode
  title: string
  subtitle?: string
  children?: ReactNode
  points?: DialogPoint[]
  textarea?: { label: string; placeholder?: string; hint?: string; maxLength?: number }
  confirmLabel: string
  cancelLabel?: string
  onConfirm: (text: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const confirm = async () => {
    setBusy(true); setError('')
    try { await onConfirm(text.trim()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие') }
    finally { setBusy(false) }   // usually the parent closes the dialog on success; if not, it must not stay locked
  }

  const pointStyle = {
    keep: { icon: <Check size={14} />, cls: 'text-green-400 bg-green-500/10' },
    warn: { icon: <AlertTriangle size={13} />, cls: 'text-orange-400 bg-orange-500/10' },
    info: { icon: <Info size={13} />, cls: 'text-gray-400 bg-[#2a2a2a]' },
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-[200] p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3.5 px-5 pt-5">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${TONE[tone].tile}`}>{icon}</div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-white font-semibold text-base leading-tight">{title}</h3>
            {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
          </div>
          <button onClick={onCancel} disabled={busy} className="text-gray-500 hover:text-white disabled:opacity-40 -mt-0.5"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4 space-y-3.5">
          {children}

          {points && points.length > 0 && (
            <ul className="space-y-2">
              {points.map((p, i) => {
                const s = pointStyle[p.kind ?? 'info']
                return (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300 leading-snug">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-px ${s.cls}`}>{s.icon}</span>
                    <span>{p.text}</span>
                  </li>
                )
              })}
            </ul>
          )}

          {textarea && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">{textarea.label}</label>
              <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3}
                maxLength={textarea.maxLength ?? 300} placeholder={textarea.placeholder}
                className="input-field text-sm resize-none" />
              {textarea.hint && <div className="text-gray-600 text-xs mt-1.5">{textarea.hint}</div>}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="px-5 py-5 flex gap-2.5">
          <button onClick={onCancel} disabled={busy}
            className="flex-1 text-sm py-2.5 rounded-lg border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-[#3a3a3a] transition-colors disabled:opacity-40">
            {cancelLabel}
          </button>
          <button onClick={confirm} disabled={busy}
            className={`flex-1 text-sm py-2.5 rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${TONE[tone].button}`}>
            {busy && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
