import { useState, useEffect } from 'react'
import { X, Search, LogOut, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import type { Appointment } from '../../types'
import { appointmentRowClass } from '../../utils/appointmentStyle'
import { OrderTag, TaxiMark } from '../../components/OrderTags'
import { formatMoney } from '../../utils/pricing'
import { CompleteOrderModal } from '../../components/CompleteOrderModal'
import { BrandLogo } from '../../components/CarFormModal'
import { api } from '../../api'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400',
  confirmed:  'bg-blue-500/20 text-blue-400',
  in_progress:'bg-orange-500/20 text-orange-400',
  completed:  'bg-green-500/20 text-green-400',
  cancelled:  'bg-red-500/20 text-red-400',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', confirmed: 'Подтверждено', in_progress: 'В работе',
  completed: 'Выполнено', cancelled: 'Отменено',
}
const TAB_STATUSES = ['in_progress', 'completed', 'cancelled'] as const
const TAB_LABELS: Record<string, string> = {
  in_progress: 'В работе', completed: 'Выполнено', cancelled: 'Отменено',
}

// ─── Cancel modal (same as AppointmentsPage) ───────────────────────────────────
function CancelModal({ apt, onClose, onConfirm }: {
  apt: Appointment
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Отмена записи</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="text-sm text-gray-400 mb-4">
          {apt.clientName} · {apt.carMake} {apt.carModel} · {apt.date.split('-').reverse().join('.')} {apt.time}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">Причина отмены</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            className="input-field text-sm resize-none w-full" rows={3}
            placeholder="Укажите причину отмены..." autoFocus />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-outline flex-1">Назад</button>
          <button onClick={() => onConfirm(reason)}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-medium">
            Отменить запись
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Master page ───────────────────────────────────────────────────────────────
export default function MasterPage() {
  const { appointments, employees, updateAppointmentStatus, updateAppointment } = useApp()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('in_progress')
  const [completing, setCompleting] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [brandsMap, setBrandsMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    api.getCarBrands().then(d => {
      const map: Record<string, string | null> = {}
      d.forEach(b => { map[b.name] = b.image_url })
      setBrandsMap(map)
    }).catch(() => {})
  }, [])

  const masterId = user?.masterId ?? user?.id ?? ''

  const masterApts = appointments.filter(a => a.masterId === masterId)

  const filtered = masterApts.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.clientName.toLowerCase().includes(q) ||
      a.licensePlate.toLowerCase().includes(q) ||
      a.carMake.toLowerCase().includes(q) ||
      a.carModel.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'in_progress'
      ? (a.status === 'pending' || a.status === 'in_progress')
      : a.status === statusFilter
    return matchSearch && matchStatus
  }).sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date)
    return dateCompare !== 0 ? dateCompare : b.time.localeCompare(a.time)
  })

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Мои записи</h1>
          <p className="text-gray-500 text-sm">{user?.name}</p>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm">
          <LogOut size={16} />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TAB_STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === s ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white'
            }`}>
            {TAB_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Клиент, номер, авто..."
            className="input-field !pl-10 text-sm" />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="px-3 text-gray-400 hover:text-white border border-[#2a2a2a] rounded-lg">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Mobile cards ─────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="card p-8 text-center text-gray-600 text-sm">Записей не найдено</div>
        )}
        {filtered.map(apt => {
          const isOpen = expandedId === apt.id
          const canAct = statusFilter === 'in_progress'
          return (
            <div key={apt.id} className="card overflow-hidden">
              {/* Header */}
              <div className="p-3 cursor-pointer select-none" onClick={() => setExpandedId(isOpen ? null : apt.id)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-white text-sm font-medium">
                    {apt.date.split('-').reverse().join('.')}
                    {apt.time && <span className="text-gray-500 font-normal ml-1.5">{apt.time}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {apt.status !== 'completed' ? (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[apt.status]}`}>{STATUS_LABELS[apt.status]}</span>
                    ) : apt.total ? (
                      <span className="text-green-400 text-sm font-semibold">{apt.total.toLocaleString('ru-RU')} ₸</span>
                    ) : null}
                    <ChevronDown size={15} className={`text-gray-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <TaxiMark apt={apt} />
                    <span className="text-white text-sm font-medium">{apt.clientName}</span>
                  </span>
                  <OrderTag apt={apt} />
                  <span className="text-gray-500 text-xs">{apt.clientPhone}</span>
                </div>
                {apt.carMake ? (
                  <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#0f0f0f] mt-2">
                    <div className="flex items-center gap-2.5 mb-2">
                      <BrandLogo brand={apt.carMake} imageUrl={brandsMap[apt.carMake]} size="sm" />
                      <span className="text-white text-sm font-medium">{apt.carMake} {apt.carModel}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {apt.carYear && <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{apt.carYear}</span></div>}
                      {apt.engineType && <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{apt.engineType} {apt.engineVolume}л</span></div>}
                      {apt.mileage ? <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{apt.mileage.toLocaleString()} км</span></div> : null}
                      {apt.licensePlate && <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-bold">{apt.licensePlate}</span></div>}
                    </div>
                  </div>
                ) : null}
                {!isOpen && apt.services.length > 0 && (
                  <div className="text-gray-600 text-xs mt-1.5 truncate">{apt.services.join(', ')}</div>
                )}
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div className="border-t border-[#2a2a2a] p-3 space-y-3">
                  {apt.services.length > 0 && (
                    <div>
                      <div className="text-gray-500 text-xs mb-1.5 font-medium">Услуги</div>
                      <div className="space-y-1">
                        {apt.services.map(s => (
                          <div key={s} className="text-gray-300 text-sm flex items-start gap-1.5">
                            <span className="text-orange-500 shrink-0 mt-0.5">•</span>{s}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {canAct && (
                    <div className="flex gap-2 pt-1">
                      {apt.status === 'pending' && (
                        <button onClick={() => updateAppointmentStatus(apt.id, 'in_progress')}
                          className="flex-1 py-2.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors font-medium">
                          В работу
                        </button>
                      )}
                      {apt.status === 'in_progress' && (
                        <button onClick={() => setCompleting(apt)}
                          className="flex-1 py-2.5 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors font-medium">
                          Завершить
                        </button>
                      )}
                      <button onClick={() => setCancelling(apt)}
                        className="py-2.5 px-3 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  <button onClick={() => { setSelected(apt); setExpandedId(null) }}
                    className="w-full py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors border-t border-[#1a1a1a] mt-1 pt-3">
                    Открыть детали записи →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
                <th className="text-left px-4 py-3 font-medium">Дата / Время</th>
                <th className="text-left px-4 py-3 font-medium">Клиент</th>
                <th className="text-left px-4 py-3 font-medium">Автомобиль</th>
                <th className="text-left px-4 py-3 font-medium">Услуги</th>
                <th className="text-left px-4 py-3 font-medium">Статус</th>
                {statusFilter === 'in_progress' && <th className="text-left px-4 py-3 font-medium">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(apt => (
                <tr key={apt.id} className={`border-b border-[#1a1a1a] ${appointmentRowClass(apt)} transition-colors cursor-pointer`}
                  onClick={() => setSelected(apt)}>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{apt.date.split('-').reverse().join('.')}</div>
                    <div className="text-gray-500 text-xs">{apt.time || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white flex items-center gap-2"><TaxiMark apt={apt} />{apt.clientName}<OrderTag apt={apt} /></div>
                    <div className="text-gray-500 text-xs whitespace-nowrap">{apt.clientPhone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {apt.carMake && <BrandLogo brand={apt.carMake} imageUrl={brandsMap[apt.carMake]} size="sm" />}
                      <div>
                        <div className="text-gray-300">{apt.carMake ? `${apt.carMake} ${apt.carModel}` : '—'}</div>
                        <div className="text-orange-400 text-xs font-bold">{apt.licensePlate || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-400 text-xs max-w-[160px] truncate">
                      {apt.services.length > 0 ? apt.services.join(', ') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {apt.status !== 'completed' && (
                      <span className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${STATUS_COLORS[apt.status]}`}>
                        {STATUS_LABELS[apt.status]}
                      </span>
                    )}
                    {apt.total ? <div className="text-green-400 text-xs font-medium mt-0.5">{apt.total.toLocaleString('ru-RU')} ₸</div> : null}
                  </td>
                  {statusFilter === 'in_progress' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {apt.status === 'pending' && (
                          <button onClick={() => updateAppointmentStatus(apt.id, 'in_progress')}
                            className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors whitespace-nowrap">
                            В работу
                          </button>
                        )}
                        {apt.status === 'in_progress' && (
                          <button onClick={() => setCompleting(apt)}
                            className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors whitespace-nowrap">
                            Завершить
                          </button>
                        )}
                        <button onClick={() => setCancelling(apt)}
                          className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={statusFilter === 'in_progress' ? 6 : 5} className="text-center text-gray-600 py-10">
                    Записей не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Детали записи</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Дата</div>
                  <div className="text-white">{selected.date.split('-').reverse().join('.')} {selected.time}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Статус</div>
                  <span className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                </div>
              </div>
              <div className="border-t border-[#2a2a2a]" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Клиент</div>
                  <div className="text-white">{selected.clientName}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Телефон</div>
                  <div className="text-white">{selected.clientPhone}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 text-xs mb-1">Автомобиль</div>
                  {selected.carMake ? (
                    <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#0f0f0f]">
                      <div className="flex items-center gap-2.5 mb-2">
                        <BrandLogo brand={selected.carMake} imageUrl={brandsMap[selected.carMake]} size="sm" />
                        <span className="text-white text-sm font-medium">{selected.carMake} {selected.carModel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{selected.carYear}</span></div>
                        <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{selected.engineType} {selected.engineVolume}л</span></div>
                        <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{selected.mileage?.toLocaleString()} км</span></div>
                        {selected.licensePlate && <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-medium">{selected.licensePlate}</span></div>}
                      </div>
                    </div>
                  ) : <div className="text-white">—</div>}
                </div>
              </div>
              <div className="border-t border-[#2a2a2a]" />
              <div className="space-y-3">
                <div>
                  <div className="text-gray-500 text-xs mb-2">Услуги</div>
                  <div className="space-y-1.5">
                    {selected.services.map(s => (
                      <div key={s} className="text-white text-sm flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Масло</div>
                  <div className="text-white">{selected.oilPreference}</div>
                </div>
                {selected.comment && (
                  <div className="mt-2 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <div className="text-gray-500 text-xs mb-1.5">Комментарий</div>
                    <div className="text-gray-200 text-sm leading-relaxed">{selected.comment}</div>
                  </div>
                )}
                {selected.cancelReason && (
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Причина отмены</div>
                    <div className="text-red-400">{selected.cancelReason}</div>
                  </div>
                )}
                {selected.total ? (
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Итого</div>
                    <div className="text-green-400 font-semibold text-base">{selected.total.toLocaleString()} ₸</div>
                  </div>
                ) : null}
              </div>
              {selected.serviceRecord && (
                <>
                  <div className="border-t border-[#2a2a2a]" />
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Выполненные работы</div>
                    {selected.serviceRecord.oil && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Масло</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-gray-500">Бренд: </span><span className="text-gray-200">{selected.serviceRecord.oil.brand}</span></div>
                          <div><span className="text-gray-500">Вязкость: </span><span className="text-gray-200">{selected.serviceRecord.oil.viscosity}</span></div>
                          <div><span className="text-gray-500">Объём: </span><span className="text-gray-200">{selected.serviceRecord.oil.liters} л</span></div>
                          {!!selected.serviceRecord.oil.cost && (
                            <div className="col-span-3 flex justify-between border-t border-[#2a2a2a] pt-2 mt-1">
                              <span className="text-gray-500">{selected.serviceRecord.oil.liters} л × {formatMoney(selected.serviceRecord.oil.pricePerLiter ?? 0)}/л</span>
                              <span className="text-white font-medium">{formatMoney(selected.serviceRecord.oil.cost)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {(selected.serviceRecord.oilFilter || selected.serviceRecord.airFilter || selected.serviceRecord.cabinFilter) && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Фильтры</div>
                        <div className="space-y-1 text-xs">
                          {selected.serviceRecord.oilFilter && <div><span className="text-gray-500">Масляный: </span><span className="text-gray-200">{selected.serviceRecord.oilFilter}</span></div>}
                          {selected.serviceRecord.airFilter && <div><span className="text-gray-500">Воздушный: </span><span className="text-gray-200">{selected.serviceRecord.airFilter}</span></div>}
                          {selected.serviceRecord.cabinFilter && <div><span className="text-gray-500">Салонный: </span><span className="text-gray-200">{selected.serviceRecord.cabinFilter}</span></div>}
                        </div>
                      </div>
                    )}
                    {selected.serviceRecord.items && selected.serviceRecord.items.filter(it => it.category !== 'oil').length > 0 && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Материалы</div>
                        <div className="space-y-1.5 text-xs">
                          {selected.serviceRecord.items.filter(it => it.category !== 'oil').map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className="text-gray-200">{it.brand ? `${it.brand} · ` : ''}{it.name} <span className="text-gray-500">× {it.quantity} {it.unit}</span></span>
                              <span className="text-white font-medium">{formatMoney(it.cost)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.serviceRecord.servicePrices && Object.keys(selected.serviceRecord.servicePrices).length > 0 && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Разбивка по услугам</div>
                        <div className="space-y-1.5">
                          {Object.entries(selected.serviceRecord.servicePrices).map(([service, price]) => (
                            <div key={service} className="flex justify-between items-center text-xs">
                              <span className="text-gray-400">{service}</span>
                              <span className="text-white font-medium">{(price as number).toLocaleString('ru-RU')} ₸</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selected.serviceRecord.notes && (
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Замечания мастера</div>
                        <div className="text-gray-300 text-sm leading-relaxed">{selected.serviceRecord.notes}</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {completing && (
        <CompleteOrderModal
          apt={completing}
          onClose={() => setCompleting(null)}
          onSave={async (data) => { await updateAppointment(completing.id, data); setCompleting(null) }}
        />
      )}

      {cancelling && (
        <CancelModal
          apt={cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={(reason) => {
            updateAppointment(cancelling.id, { status: 'cancelled', cancelReason: reason || undefined })
            setCancelling(null)
          }}
        />
      )}
    </div>
  )
}
