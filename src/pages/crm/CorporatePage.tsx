import { useEffect, useState } from 'react'
import { Search, X, Building2, ChevronRight, FileText, Download, Plus, Pencil, Check, Send, Trash2, Archive, ArchiveRestore, Ban, Info, UserX } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api'
import { ActionDialog, CarSummary } from '../../components/ActionDialog'
import { Badge, Counter, Caption } from '../../components/ui'
import { onLive } from '../../utils/liveEvents'
import type { CorporateClient, Car as CarType, CarDeleteRequest } from '../../types'

interface Props { corporateView?: boolean }

const STATUS_COLOR = (car: CarType) => {
  if (!car.nextService) return 'text-gray-500'
  const days = Math.ceil((new Date(car.nextService).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-400'
  if (days < 30) return 'text-orange-400'
  return 'text-green-400'
}
const STATUS_TEXT = (car: CarType) => {
  if (!car.nextService) return '—'
  const days = Math.ceil((new Date(car.nextService).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'Просрочено'
  if (days < 30) return 'Скоро ТО'
  return 'ОК'
}

type CorpForm = Omit<CorporateClient, 'id' | 'cars'>
const EMPTY_FORM: CorpForm = { companyName: '', contactPerson: '', phone: '', email: '', contract: '', comment: '' }

const FInput = ({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1 font-medium">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="input-field text-sm" />
  </div>
)

function CorpModal({ company, onClose, onSave }: {
  company?: CorporateClient
  onClose: () => void
  onSave: (form: CorpForm) => Promise<void>
}) {
  const [form, setForm] = useState<CorpForm>(
    company
      ? { companyName: company.companyName, contactPerson: company.contactPerson, phone: company.phone, email: company.email ?? '', contract: company.contract ?? '', comment: company.comment ?? '' }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof CorpForm) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.companyName || !form.phone) { setError('Укажите название компании и телефон'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{company ? 'Редактировать компанию' : 'Добавить компанию'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <FInput label="Название компании *" value={form.companyName} onChange={set('companyName')} placeholder="ТОО «Такси Алматы»" />
          <FInput label="Контактное лицо" value={form.contactPerson} onChange={set('contactPerson')} placeholder="Иван Иванов" />
          <FInput label="Телефон *" value={form.phone} onChange={set('phone')} placeholder="+7 (701) 000-00-00" />
          <FInput label="Email" type="email" value={form.email} onChange={set('email')} placeholder="info@company.kz" />
          <FInput label="Договор" value={form.contract ?? ''} onChange={set('contract')} placeholder="№ 2025-001" />
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Комментарий</label>
            <textarea value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
              className="input-field text-sm resize-none" rows={2} placeholder="Примечания..." />
          </div>
        </div>
        {error && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
            <Check size={15} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

type TgInfo = Awaited<ReturnType<typeof api.getCorporateTelegram>>

function TelegramTab({ companyId }: { companyId: string }) {
  const [info, setInfo] = useState<TgInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const load = () => api.getCorporateTelegram(companyId).then(setInfo).catch(e => setError(e.message))
  useEffect(() => { load() }, [companyId])

  const generate = async () => {
    setBusy(true); setError('')
    try { await api.createConnectCode(companyId); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка') }
    finally { setBusy(false) }
  }
  const [revoking, setRevoking] = useState<TgInfo['users'][number] | null>(null)
  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1500) }).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
        <div className="text-white font-semibold text-sm mb-1">Код подключения к Telegram-боту</div>
        <div className="text-gray-500 text-xs mb-3">
          Одноразовый код, действует 72 часа. Передайте его представителю таксопарка — он вводит код в боте
          {info?.botUsername ? <> <span className="text-orange-400">@{info.botUsername}</span></> : ''}.
          Для каждого нового сотрудника нужен новый код.
        </div>
        {info?.code ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-mono font-bold text-orange-400 tracking-wider">{info.code}</div>
              <button onClick={() => copy(info.code!, 'code')} className="text-xs text-gray-400 hover:text-white">
                {copied === 'code' ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            {info.link && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 truncate">{info.link}</span>
                <button onClick={() => copy(info.link!, 'link')} className="text-gray-400 hover:text-white shrink-0">
                  {copied === 'link' ? 'Скопировано' : 'Копировать ссылку'}
                </button>
              </div>
            )}
            {info.codeExpiresAt && (
              <div className="text-gray-600 text-xs">Действует до {new Date(info.codeExpiresAt).toLocaleString('ru-RU')}</div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-xs mb-1">Активного кода нет.</div>
        )}
        <button onClick={generate} disabled={busy}
          className="btn-orange mt-3 flex items-center gap-2 text-sm disabled:opacity-60">
          <Send size={14} /> {info?.code ? 'Сгенерировать новый код' : 'Сгенерировать код'}
        </button>
        {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
      </div>

      <div>
        <div className="text-gray-400 text-xs font-medium mb-2">Подключённые пользователи</div>
        {info?.users.length ? (
          <div className="space-y-2">
            {info.users.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                <div>
                  <div className="text-white text-sm">{u.name || 'Без имени'}</div>
                  <div className="text-gray-500 text-xs">
                    {u.username ? `@${u.username} · ` : ''}с {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <button onClick={() => setRevoking(u)} className="p-1.5 text-gray-500 hover:text-red-400" title="Отключить">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600 text-sm text-center py-4">Пока никто не подключён</div>
        )}
      </div>

      {revoking && (
        <ActionDialog
          tone="danger" icon={<UserX size={20} />}
          title="Отключить от бота?"
          subtitle={revoking.name || 'Пользователь без имени'}
          points={[
            { kind: 'warn', text: 'Пользователь потеряет доступ к автопарку и отчётам в Telegram.' },
            { kind: 'info', text: 'Подключить его снова можно новым одноразовым кодом.' },
          ]}
          confirmLabel="Отключить"
          onConfirm={async () => { await api.removeTelegramUser(revoking.id); await load(); setRevoking(null) }}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  )
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Requests to delete a car. The corporate client can only ask (from the bot) — the decision is made here.
function RequestsTab({ requests, onDecided }: { requests: CarDeleteRequest[]; onDecided: () => void }) {
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'reject'; r: CarDeleteRequest } | null>(null)
  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  const requestLines = (r: CarDeleteRequest) => [
    `${r.requestedBy ? `${r.requestedBy} · ` : ''}${fmtDateTime(r.createdAt)}`,
    r.kind === 'restore'
      ? <span className="text-gray-300">Просит вернуть автомобиль из архива</span>
      : r.reason ? <span className="text-gray-300">Причина: «{r.reason}»</span> : <span>Причина не указана</span>,
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 bg-[#111] border border-[#2a2a2a] rounded-lg px-3.5 py-3 text-xs text-gray-400 leading-relaxed">
        <Info size={15} className="text-orange-400 shrink-0 mt-px" />
        <span>
          Таксопарк не может ни удалить, ни вернуть автомобиль сам — он отправляет запрос из Telegram-бота, а решение принимаете вы.
          Удаление означает перенос в архив: история, заказы и траты остаются в базе и в отчётах.
        </span>
      </div>

      {pending.length === 0 && (
        <div className="text-center py-8">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-2.5"><Check size={20} /></div>
          <div className="text-gray-300 text-sm font-medium">Новых запросов нет</div>
          <div className="text-gray-600 text-xs mt-0.5">Когда таксопарк попросит удалить автомобиль, запрос появится здесь</div>
        </div>
      )}

      {pending.map(r => (
        <div key={r.id} className="rounded-xl border border-orange-500/30 bg-orange-500/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="px-2.5 py-1.5 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-sm tracking-wide shrink-0">
              {r.licensePlate}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-medium truncate">{r.carLabel}</div>
              <div className="text-gray-500 text-xs mt-0.5">{r.requestedBy ? `${r.requestedBy} · ` : ''}{fmtDateTime(r.createdAt)}</div>
            </div>
            <Badge tone={r.kind === 'restore' ? 'green' : 'red'} className="uppercase tracking-wide">
              {r.kind === 'restore' ? 'Восстановление' : 'Удаление'}
            </Badge>
          </div>
          <div className="mt-3 rounded-lg bg-[#111] border border-[#2a2a2a] px-3 py-2.5">
            {r.kind === 'restore' ? (
              <>
                <Caption>Запрос</Caption>
                <div className="text-sm text-gray-200">Таксопарк хочет вернуть автомобиль из архива в автопарк</div>
              </>
            ) : (
              <>
                <Caption>Причина</Caption>
                <div className={`text-sm ${r.reason ? 'text-gray-200' : 'text-gray-600 italic'}`}>{r.reason ? `«${r.reason}»` : 'не указана'}</div>
              </>
            )}
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <button onClick={() => setDialog({ kind: 'reject', r })}
              className="flex-1 py-2 text-sm rounded-lg border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-[#3a3a3a] transition-colors flex items-center justify-center gap-1.5">
              <Ban size={14} /> Отклонить
            </button>
            {r.kind === 'restore' ? (
              <button onClick={() => setDialog({ kind: 'approve', r })}
                className="flex-1 py-2 text-sm rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-colors flex items-center justify-center gap-1.5 font-medium">
                <ArchiveRestore size={14} /> Восстановить
              </button>
            ) : (
              <button onClick={() => setDialog({ kind: 'approve', r })}
                className="flex-1 py-2 text-sm rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors flex items-center justify-center gap-1.5 font-medium">
                <Archive size={14} /> Удалить в архив
              </button>
            )}
          </div>
        </div>
      ))}

      {resolved.length > 0 && (
        <div>
          <div className="text-gray-400 text-xs font-medium mb-2">История решений</div>
          <div className="space-y-1.5">
            {resolved.slice(0, 15).map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
                <div className="px-2 py-1 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 font-bold text-xs shrink-0">{r.licensePlate}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-gray-400 text-xs truncate">{r.carLabel} <span className="text-gray-600">· {r.kind === 'restore' ? 'восстановление' : 'удаление'}</span></div>
                  {r.adminComment && <div className="text-gray-600 text-xs truncate">«{r.adminComment}»</div>}
                </div>
                <div className="text-right shrink-0">
                  <Badge tone={r.status !== 'approved' ? 'gray' : r.kind === 'restore' ? 'green' : 'red'}>
                    {r.status !== 'approved' ? 'Отклонён' : r.kind === 'restore' ? 'Восстановлен' : 'В архиве'}
                  </Badge>
                  {r.resolvedAt && <div className="text-gray-600 text-xs mt-1">{fmtDateTime(r.resolvedAt)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dialog?.kind === 'approve' && dialog.r.kind === 'restore' && (
        <ActionDialog
          tone="success" icon={<ArchiveRestore size={20} />}
          title="Восстановить автомобиль?"
          subtitle={`Запрос от «${dialog.r.companyName}»`}
          points={[
            { kind: 'keep', text: 'Автомобиль вернётся в автопарк таксопарка — на сайте и в Telegram-боте.' },
            { kind: 'keep', text: 'Вся история обслуживания и заказы на месте.' },
            { kind: 'info', text: 'Таксопарк получит уведомление в Telegram.' },
          ]}
          confirmLabel="Восстановить"
          onConfirm={async () => { await api.approveCarDeleteRequest(dialog.r.id); onDecided(); setDialog(null) }}
          onCancel={() => setDialog(null)}
        >
          <CarSummary plate={dialog.r.licensePlate} label={dialog.r.carLabel} lines={requestLines(dialog.r)} />
        </ActionDialog>
      )}

      {dialog?.kind === 'approve' && dialog.r.kind !== 'restore' && (
        <ActionDialog
          tone="danger" icon={<Archive size={20} />}
          title="Удалить автомобиль?"
          subtitle={`Запрос от «${dialog.r.companyName}»`}
          points={[
            { kind: 'info', text: 'Автомобиль уйдёт в архив и пропадёт из списков сайта и бота.' },
            { kind: 'keep', text: 'История обслуживания, заказы и траты сохранятся и останутся в отчётах.' },
            { kind: 'keep', text: 'Госномер останется занятым. Вернуть автомобиль можно во вкладке «Автомобили».' },
            { kind: 'info', text: 'Таксопарк получит уведомление в Telegram.' },
          ]}
          confirmLabel="Удалить в архив"
          onConfirm={async () => { await api.approveCarDeleteRequest(dialog.r.id); onDecided(); setDialog(null) }}
          onCancel={() => setDialog(null)}
        >
          <CarSummary plate={dialog.r.licensePlate} label={dialog.r.carLabel} lines={requestLines(dialog.r)} />
        </ActionDialog>
      )}

      {dialog?.kind === 'reject' && (
        <ActionDialog
          tone="neutral" icon={<Ban size={20} />}
          title={dialog.r.kind === 'restore' ? 'Отклонить восстановление?' : 'Отклонить удаление?'}
          subtitle={`Запрос от «${dialog.r.companyName}»`}
          textarea={{
            label: 'Комментарий для таксопарка (необязательно)',
            placeholder: 'Например: по автомобилю есть незавершённые записи',
            hint: 'Клиент получит его в Telegram вместе с уведомлением об отказе.',
          }}
          confirmLabel="Отклонить запрос"
          onConfirm={async (comment) => { await api.rejectCarDeleteRequest(dialog.r.id, comment); onDecided(); setDialog(null) }}
          onCancel={() => setDialog(null)}
        >
          <CarSummary plate={dialog.r.licensePlate} label={dialog.r.carLabel} lines={requestLines(dialog.r)} />
        </ActionDialog>
      )}
    </div>
  )
}

function CompanyDetail({ company, onClose, onEdit, canManageTelegram, requests, onDecided }: {
  company: CorporateClient
  onClose: () => void
  onEdit: () => void
  canManageTelegram: boolean
  requests: CarDeleteRequest[]
  onDecided: () => void
}) {
  const [tab, setTab] = useState<'cars' | 'history' | 'report' | 'requests' | 'telegram'>('cars')
  const [restoring, setRestoring] = useState<CarType | null>(null)
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const [searchCar, setSearchCar] = useState('')

  const filteredCars = company.cars.filter(c => {
    const q = searchCar.toLowerCase()
    return !q || c.licensePlate.toLowerCase().includes(q) || c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q)
  })

  // Archived ("deleted") cars still count: their history and spending stay in the company's totals and reports
  const archivedCars = company.archivedCars ?? []
  const allCars = [...company.cars, ...archivedCars]
  const allHistory = allCars.flatMap(car =>
    car.serviceHistory.map(h => ({ ...h, car }))
  ).sort((a, b) => b.date.localeCompare(a.date))

  const totalOil = allHistory.reduce((s, h) => s + (h.oil?.liters ?? 0), 0)
  const totalAmount = allHistory.reduce((s, h) => s + h.total, 0)
  const totalFilters = allHistory.reduce((s, h) =>
    s + Object.values(h.filters).filter(Boolean).length, 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Fixed-size window: the header and tabs never move, only the content below them scrolls */}
      <div data-testid="company-modal" className="card w-full max-w-3xl h-[min(88vh,780px)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div data-testid="company-modal-header" className="shrink-0 px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-lg">{company.companyName}</h3>
            <div className="text-gray-500 text-sm">{company.contactPerson} · {company.phone}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); onEdit() }}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        {company.contract && (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg px-4 py-2 mb-4 text-sm text-gray-400">
            <FileText size={14} className="inline-block text-orange-500 mr-1" />
            Договор: {company.contract}
          </div>
        )}

        {/* Tab labels are constant; counters are pills, so switching tabs never changes the bar's layout */}
        <div data-testid="company-modal-tabs" className="flex gap-1 mb-4 bg-[#111] p-1 rounded-lg overflow-x-auto">
          {(['cars', 'history', 'report', ...(canManageTelegram ? ['requests' as const, 'telegram' as const] : [])] as const).map(t => {
            const count = t === 'cars' ? company.cars.length : t === 'requests' ? pendingCount : 0
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 min-w-max h-9 px-3 rounded-md text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 transition-colors ${
                  tab === t ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                {{ cars: 'Автомобили', history: 'История работ', report: 'Отчёт', requests: 'Запросы', telegram: 'Telegram' }[t]}
                {count > 0 && <Counter tone={t === 'requests' ? 'orange' : 'gray'} active={tab === t}>{count}</Counter>}
              </button>
            )
          })}
        </div>
        </div>

        <div data-testid="company-modal-body" className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
        {tab === 'requests' && canManageTelegram && <RequestsTab requests={requests} onDecided={onDecided} />}
        {tab === 'telegram' && canManageTelegram && <TelegramTab companyId={company.id} />}

        {tab === 'cars' && (
          <div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchCar} onChange={e => setSearchCar(e.target.value)}
                placeholder="Поиск по номеру..." className="input-field !pl-10 text-sm" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-[#2a2a2a]">
                    <th className="text-left py-2.5 font-medium">Гос. номер</th>
                    <th className="text-left py-2.5 font-medium">Марка / Модель</th>
                    <th className="text-left py-2.5 font-medium">Пробег</th>
                    <th className="text-left py-2.5 font-medium">Посл. ТО</th>
                    <th className="text-left py-2.5 font-medium">След. ТО</th>
                    <th className="text-left py-2.5 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCars.map(car => (
                    <tr key={car.id} className="border-b border-[#1a1a1a]">
                      <td className="py-2.5 text-orange-400 font-bold">{car.licensePlate}</td>
                      <td className="py-2.5 text-gray-300">{car.make} {car.model} {car.year}</td>
                      <td className="py-2.5 text-gray-400">{car.mileage.toLocaleString()} км</td>
                      <td className="py-2.5 text-gray-400">{car.lastService ?? '—'}</td>
                      <td className="py-2.5 text-gray-400">{car.nextService ?? '—'}</td>
                      <td className={`py-2.5 font-medium ${STATUS_COLOR(car)}`}>{STATUS_TEXT(car)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManageTelegram && archivedCars.length > 0 && (
              <div className="mt-5">
                <div className="text-gray-400 text-sm font-medium mb-2">
                  Архив ({archivedCars.length}) <span className="text-gray-600 font-normal">— история и траты сохранены и входят в отчёты</span>
                </div>
                <div className="space-y-1.5">
                  {archivedCars.map(car => (
                    <div key={car.id} className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm">
                      <div>
                        <span className="text-orange-400/70 font-bold">{car.licensePlate}</span>
                        <span className="text-gray-500"> · {car.make} {car.model} · {car.serviceHistory.length} зап.</span>
                      </div>
                      <button onClick={() => setRestoring(car)}
                        className="h-8 px-3 text-sm bg-green-500/15 border border-green-500/25 text-green-400 rounded-md hover:bg-green-500/25 transition-colors flex items-center gap-1.5">
                        <ArchiveRestore size={12} /> Восстановить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
                <div className="text-white font-bold text-lg">{allHistory.length}</div>
                <div className="text-gray-500 text-xs">Обслужено</div>
              </div>
              <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
                <div className="text-orange-400 font-bold text-lg">{totalOil.toFixed(1)}л</div>
                <div className="text-gray-500 text-xs">Масла использовано</div>
              </div>
              <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
                <div className="text-green-400 font-bold text-lg">{totalAmount.toLocaleString()} ₸</div>
                <div className="text-gray-500 text-xs">Общая сумма</div>
              </div>
            </div>
            <div className="space-y-2">
              {allHistory.map((h, i) => (
                <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-orange-400 font-bold text-sm">{h.car.licensePlate}</span>
                      <span className="text-gray-400 text-sm ml-2">{h.car.make} {h.car.model}</span>
                      {h.car.isArchived && <Badge className="ml-2">в архиве</Badge>}
                    </div>
                    <div className="text-green-400 text-sm font-semibold">{h.total.toLocaleString()} ₸</div>
                  </div>
                  <div className="text-gray-500 text-xs">{h.date} · {h.mileage.toLocaleString()} км</div>
                  <div className="text-gray-300 text-sm mt-1">{h.services.join(', ')}</div>
                  {h.oil && <div className="text-blue-400 text-xs mt-0.5">🛢️ {h.oil.brand} {h.oil.viscosity} {h.oil.liters}л</div>}
                </div>
              ))}
              {allHistory.length === 0 && <div className="text-gray-600 text-sm text-center py-4">История пуста</div>}
            </div>
          </div>
        )}

        {tab === 'report' && (
          <div>
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 mb-4">
              <h4 className="text-white font-semibold mb-1">{company.companyName}</h4>
              <div className="text-gray-500 text-xs mb-3">Отчёт по обслуживанию автомобилей</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#2a2a2a]">
                      <th className="text-left py-1.5 font-medium">Дата</th>
                      <th className="text-left py-1.5 font-medium">Номер</th>
                      <th className="text-left py-1.5 font-medium">Авто</th>
                      <th className="text-left py-1.5 font-medium">Работы</th>
                      <th className="text-left py-1.5 font-medium">Масло</th>
                      <th className="text-right py-1.5 font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allHistory.map((h, i) => (
                      <tr key={i} className="border-b border-[#1a1a1a]">
                        <td className="py-1.5 text-gray-400">{h.date}</td>
                        <td className="py-1.5 text-orange-400 font-bold">{h.car.licensePlate}</td>
                        <td className="py-1.5 text-gray-300">{h.car.make} {h.car.model}</td>
                        <td className="py-1.5 text-gray-400 max-w-[120px] truncate">{h.services.join(', ')}</td>
                        <td className="py-1.5 text-blue-400">{h.oil ? `${h.oil.viscosity} ${h.oil.liters}л` : '—'}</td>
                        <td className="py-1.5 text-right text-green-400">{h.total.toLocaleString()} ₸</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#2a2a2a] pt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">Обслужено автомобилей: <span className="text-white">{allCars.filter(c => c.serviceHistory.length > 0).length}</span></div>
                <div className="text-gray-500">Замен масла: <span className="text-white">{allHistory.filter(h => h.services.some(s => s.includes('масла двигателя'))).length}</span></div>
                <div className="text-gray-500">Замен фильтров: <span className="text-white">{totalFilters}</span></div>
                <div className="text-gray-500">Использовано масла: <span className="text-orange-400">{totalOil.toFixed(1)} л</span></div>
                <div className="col-span-2 text-right text-sm font-semibold mt-1">
                  Итого: <span className="text-green-400">{totalAmount.toLocaleString()} ₸</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-outline flex-1 flex items-center justify-center gap-2 text-sm">
                <Download size={14} /> PDF
              </button>
              <button className="btn-orange flex-1 flex items-center justify-center gap-2 text-sm">
                <Download size={14} /> Excel
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {restoring && (
        <ActionDialog
          tone="success" icon={<ArchiveRestore size={20} />}
          title="Восстановить автомобиль?"
          subtitle="Вернуть из архива в автопарк"
          points={[
            { kind: 'keep', text: 'Автомобиль снова появится в списках сайта и в Telegram-боте таксопарка.' },
            { kind: 'keep', text: 'Вся история обслуживания и заказы на месте.' },
          ]}
          confirmLabel="Восстановить"
          onConfirm={async () => { await api.restoreCar(restoring.id); onDecided(); setRestoring(null) }}
          onCancel={() => setRestoring(null)}
        >
          <CarSummary plate={restoring.licensePlate} label={`${restoring.make} ${restoring.model} · ${restoring.year}`}
            lines={[`${restoring.serviceHistory.length} записей в техкнижке`]} />
        </ActionDialog>
      )}
    </div>
  )
}

export default function CorporatePage({ corporateView }: Props) {
  const { corporateClients, addCorporate, updateCorporate, refreshData } = useApp()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modal, setModal] = useState<'add' | CorporateClient | null>(null)
  const [requests, setRequests] = useState<CarDeleteRequest[]>([])

  // Car deletion requests from the bot are for staff only (the corporate cabinet doesn't load them)
  const loadRequests = () => {
    if (corporateView) return
    api.getCarDeleteRequests('all').then(setRequests).catch(() => {})
  }
  useEffect(() => { loadRequests() }, [corporateView])
  // a new request from a taxi fleet (or a decision made in another tab) shows up here at once, without a reload
  useEffect(() => {
    if (corporateView) return
    return onLive((e) => { if (e.type === 'car_request' || (e.type === 'data' && e.what === 'car_requests')) loadRequests() })
  }, [corporateView])
  const onDecided = () => {
    loadRequests()
    refreshData()
    window.dispatchEvent(new Event('car-requests-changed'))   // updates the sidebar counter
  }
  const pendingFor = (companyId: string) => requests.filter(r => r.corporateId === companyId && r.status === 'pending').length
  const pendingTotal = requests.filter(r => r.status === 'pending').length
  // always show the freshest data of the open company (cars change when a request is approved)
  const selected = selectedId ? corporateClients.find(c => c.id === selectedId) ?? null : null
  const setSelected = (c: CorporateClient | null) => setSelectedId(c ? c.id : null)

  const companies = corporateView && user?.corporateId
    ? corporateClients.filter(c => c.id === user.corporateId)
    : corporateClients.filter(c => {
        const q = search.toLowerCase()
        return !q || c.companyName.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q)
      })

  const handleSave = async (form: CorpForm) => {
    if (modal === 'add') {
      await addCorporate(form)
    } else if (modal) {
      await updateCorporate(modal.id, form)   // the open company is re-read from context, so it refreshes itself
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">
          {corporateView ? 'Мой кабинет' : 'Корпоративные клиенты'}
        </h1>
        {!corporateView && (
          <button onClick={() => setModal('add')} className="btn-orange flex items-center gap-2 text-sm">
            <Plus size={15} /> Добавить
          </button>
        )}
      </div>

      {!corporateView && pendingTotal > 0 && (
        <div className="mb-5 rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/[0.12] via-orange-500/[0.05] to-transparent p-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              <Archive size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-white font-semibold text-sm">Запросы по автомобилям</div>
                <Counter>{pendingTotal}</Counter>
              </div>
              <div className="text-gray-400 text-xs mt-0.5">Таксопарки просят удалить или восстановить автомобили. Решение за вами.</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {corporateClients.filter(c => pendingFor(c.id) > 0).map(c => (
                  <button key={c.id} onClick={() => setSelectedId(c.id)}
                    className="group flex items-center gap-2 bg-[#1a1a1a] border border-orange-500/30 hover:border-orange-500 rounded-lg pl-3 pr-2 py-1.5 text-xs text-white transition-colors">
                    <Building2 size={13} className="text-orange-400" />
                    <span className="font-medium">{c.companyName}</span>
                    <span className="text-orange-400 bg-orange-500/10 rounded px-1.5 py-0.5 font-semibold">{pendingFor(c.id)}</span>
                    <ChevronRight size={13} className="text-gray-500 group-hover:text-orange-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!corporateView && (
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию компании..." className="input-field !pl-10 text-sm" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map(company => {
          // archived cars keep counting in the company's totals
          const everyCar = [...company.cars, ...(company.archivedCars ?? [])]
          const serviced = everyCar.filter(c => c.serviceHistory.length > 0).length
          const totalOil = everyCar.flatMap(c => c.serviceHistory).reduce((s, h) => s + (h.oil?.liters ?? 0), 0)
          const nextService = company.cars.filter(c => {
            if (!c.nextService) return false
            return Math.ceil((new Date(c.nextService).getTime() - Date.now()) / 86400000) < 30
          }).length

          return (
            <div key={company.id}
              onClick={() => setSelected(company)}
              className="card p-5 cursor-pointer hover:border-orange-500/40 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">{company.companyName}</h3>
                  <div className="text-gray-400 text-sm mt-0.5">{company.contactPerson}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{company.phone}</div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setModal(company) }}
                    className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-[#2a2a2a] transition-colors">
                    <Pencil size={14} />
                  </button>
                  <div className="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Building2 size={18} className="text-orange-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-[#111] rounded-lg p-2 text-center">
                  <div className="text-white font-bold">{company.cars.length}</div>
                  <div className="text-gray-500 text-xs">Авт.</div>
                </div>
                <div className="bg-[#111] rounded-lg p-2 text-center">
                  <div className="text-green-400 font-bold">{serviced}</div>
                  <div className="text-gray-500 text-xs">Обсл.</div>
                </div>
                <div className={`bg-[#111] rounded-lg p-2 text-center ${nextService > 0 ? 'border border-orange-500/30' : ''}`}>
                  <div className={`font-bold ${nextService > 0 ? 'text-orange-400' : 'text-gray-400'}`}>{nextService}</div>
                  <div className="text-gray-500 text-xs">Скоро ТО</div>
                </div>
              </div>

              {company.contract && (
                <div className="text-gray-500 text-xs mb-2 flex items-center gap-1">
                  <FileText size={11} /> {company.contract}
                </div>
              )}
              {pendingFor(company.id) > 0 && (
                <div className="text-orange-400 text-xs mb-2 flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1 w-fit">
                  <Archive size={11} /> Запросов по автомобилям: {pendingFor(company.id)}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Масло: <span className="text-orange-400">{totalOil.toFixed(1)} л</span>
                </div>
                <ChevronRight size={14} className="text-gray-600" />
              </div>
            </div>
          )
        })}
      </div>

      {companies.length === 0 && !selected && (
        <div className="text-center text-gray-600 py-10">Компаний не найдено</div>
      )}

      {selected && (
        <CompanyDetail
          company={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setModal(selected); setSelected(null) }}
          canManageTelegram={!corporateView}
          requests={requests.filter(r => r.corporateId === selected.id)}
          onDecided={onDecided}
        />
      )}

      {modal && (
        <CorpModal
          company={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
