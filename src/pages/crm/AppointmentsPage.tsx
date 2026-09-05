import { useState, useEffect } from 'react'
import { Search, X, Check, Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Appointment, AppointmentStatus } from '../../types'
import { BrandLogo } from '../../components/CarFormModal'
import DatePicker from '../../components/DatePicker'
import { api } from '../../api'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  in_progress: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', confirmed: 'Подтверждено', in_progress: 'В работе',
  completed: 'Выполнено', cancelled: 'Отменено',
}
const TAB_STATUSES: AppointmentStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']

function CompleteModal({ apt, onClose, onSave }: { apt: Appointment; onClose: () => void; onSave: (data: Partial<Appointment>) => Promise<void> }) {
  const { warehouse, updateWarehouseItem } = useApp()
  const oils = warehouse.filter(i => i.category === 'oil')
  const filterItems = warehouse.filter(i => i.category === 'filter')

  const [oilItemId, setOilItemId] = useState('')
  const [liters, setLiters] = useState('')
  const [oilFilterId, setOilFilterId] = useState('')
  const [airFilterId, setAirFilterId] = useState('')
  const [cabinFilterId, setCabinFilterId] = useState('')
  const [notes, setNotes] = useState('')
  const [servicePrices, setServicePrices] = useState<Record<string, string>>(
    Object.fromEntries((apt.services ?? []).map(s => [s, '']))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedOil = oils.find(i => i.id === oilItemId)
  const total = Object.values(servicePrices).reduce((sum, p) => sum + (Number(p) || 0), 0)

  const getValidationError = (): string | null => {
    if (!oilItemId) return 'Выберите масло со склада'
    const litersNum = Number(liters)
    if (!liters.trim() || isNaN(litersNum) || litersNum <= 0) return 'Укажите количество литров (например, 4.5)'
    if (litersNum > 999) return `Количество литров (${litersNum}) слишком большое — проверьте значение`
    if (!oilFilterId) return 'Выберите масляный фильтр со склада'
    const unpricedService = (apt.services ?? []).find(s => !(Number(servicePrices[s]) > 0))
    if (unpricedService) return `Укажите стоимость услуги: «${unpricedService}»`
    return null
  }

  const validationError = getValidationError()

  const handleSave = async () => {
    if (validationError || saving) return
    const litersNum = Number(liters)
    const parsed = Object.fromEntries(Object.entries(servicePrices).map(([k, v]) => [k, Number(v) || 0]))
    const oilItem = warehouse.find(i => i.id === oilItemId)!
    const oilFilterItem = warehouse.find(i => i.id === oilFilterId)
    const airFilterItem = airFilterId ? warehouse.find(i => i.id === airFilterId) : undefined
    const cabinFilterItem = cabinFilterId ? warehouse.find(i => i.id === cabinFilterId) : undefined

    setSaving(true)
    setError('')
    try {
      await onSave({
        status: 'completed',
        total,
        serviceRecord: {
          oil: { brand: oilItem.brand ?? oilItem.name, viscosity: oilItem.name, liters: litersNum },
          oilFilter: oilFilterItem?.name,
          airFilter: airFilterItem?.name,
          cabinFilter: cabinFilterItem?.name,
          notes, total,
          servicePrices: parsed,
        },
      })
      // Deduct inventory
      const deduct = async (item: typeof oilItem, amount: number) => {
        const { id, ...rest } = item
        await updateWarehouseItem(id, { ...rest, quantity: Math.max(0, item.quantity - amount) })
      }
      await deduct(oilItem, litersNum)
      if (oilFilterItem) await deduct(oilFilterItem, 1)
      if (airFilterItem) await deduct(airFilterItem, 1)
      if (cabinFilterItem) await deduct(cabinFilterItem, 1)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.toLowerCase().includes('overflow') || msg.includes('переполн')) {
        setError('Одно из числовых значений слишком большое. Проверьте количество литров и стоимость услуг.')
      } else {
        setError(msg || 'Не удалось сохранить. Попробуйте ещё раз.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Завершить заказ</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-500 hover:text-white disabled:opacity-40"><X size={18} /></button>
        </div>
        <div className="text-sm text-gray-400 mb-4">
          {apt.carMake} {apt.carModel} · {apt.licensePlate} · {apt.clientName}
        </div>
        <div className="space-y-3">
          {/* Oil */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1 font-medium">Масло *</label>
              <select value={oilItemId} onChange={e => setOilItemId(e.target.value)} className="input-field text-sm appearance-none">
                <option value="">— Выбрать со склада —</option>
                {oils.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.brand ? `${item.brand} · ` : ''}{item.name} ({item.quantity} {item.unit})
                  </option>
                ))}
              </select>
              {oils.length === 0 && <div className="text-xs text-yellow-400 mt-1">Добавьте масло на склад</div>}
              {selectedOil && (
                <div className="text-xs mt-1">
                  <span className="text-gray-500">Остаток: </span>
                  <span className={selectedOil.quantity <= selectedOil.minQuantity ? 'text-red-400' : 'text-gray-400'}>
                    {selectedOil.quantity} {selectedOil.unit}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Литров *</label>
              <input type="number" min="0.1" step="0.1" value={liters} onChange={e => setLiters(e.target.value)}
                placeholder="4.5" className="input-field text-sm" />
            </div>
          </div>

          {/* Oil filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Масляный фильтр *</label>
            <select value={oilFilterId} onChange={e => setOilFilterId(e.target.value)} className="input-field text-sm appearance-none">
              <option value="">— Выбрать со склада —</option>
              {filterItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.brand ? `${item.brand} · ` : ''}{item.name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>
            {filterItems.length === 0 && <div className="text-xs text-yellow-400 mt-1">Добавьте фильтры на склад</div>}
          </div>

          {/* Air filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Воздушный фильтр</label>
            <select value={airFilterId} onChange={e => setAirFilterId(e.target.value)} className="input-field text-sm appearance-none">
              <option value="">— Не использовался —</option>
              {filterItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.brand ? `${item.brand} · ` : ''}{item.name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Cabin filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Салонный фильтр</label>
            <select value={cabinFilterId} onChange={e => setCabinFilterId(e.target.value)} className="input-field text-sm appearance-none">
              <option value="">— Не использовался —</option>
              {filterItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.brand ? `${item.brand} · ` : ''}{item.name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Комментарий</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field text-sm resize-none" rows={2} placeholder="Комментарий мастера..." />
          </div>

          {/* Per-service prices */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">Стоимость услуг *</label>
            <div className="space-y-2">
              {(apt.services ?? []).map(s => (
                <div key={s}>
                  <label className="block text-xs text-gray-500 mb-1">{s}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={servicePrices[s] ?? ''}
                      onChange={e => setServicePrices(prev => ({ ...prev, [s]: e.target.value }))}
                      className="input-field flex-1" placeholder="Стоимость" />
                    <span className="text-gray-500 text-sm shrink-0">₸</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#2a2a2a]">
              <span className="text-gray-400 text-sm font-medium">Итого</span>
              <span className="text-white font-bold text-base">{total.toLocaleString('ru-RU')} ₸</span>
            </div>
          </div>
        </div>
        {(validationError || error) && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error || validationError}
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={saving} className="btn-outline flex-1 disabled:opacity-40">Отмена</button>
          <button onClick={handleSave} disabled={!!validationError || saving}
            className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ apt, employees, onClose, onSave }: {
  apt: Appointment
  employees: { id: string; name: string; role: string; isActive: boolean }[]
  onClose: () => void
  onSave: (date: string, time: string, masterId: string | undefined, services: string[]) => void
}) {
  const [date, setDate] = useState(apt.date)
  const [time, setTime] = useState(apt.time || '')
  const [masterId, setMasterId] = useState(apt.masterId || '')
  const [services, setServices] = useState<string[]>(apt.services ?? [])
  const [availableServices, setAvailableServices] = useState<{ id: string; name: string }[]>([])
  const [selectedService, setSelectedService] = useState('')

  useEffect(() => {
    api.getServices()
      .then(d => setAvailableServices((d as any[]).filter(s => s.isActive)))
      .catch(console.error)
  }, [])

  const addService = () => {
    if (selectedService && !services.includes(selectedService)) {
      setServices(prev => [...prev, selectedService])
      setSelectedService('')
    }
  }

  const masters = employees.filter(e => e.isActive && ['master', 'admin', 'owner'].includes((e.role ?? '').toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Изменить запись</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="text-sm text-gray-400 mb-4">
          {apt.clientName} · {apt.clientPhone}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Дата</label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Время</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Мастер</label>
            <select value={masterId} onChange={e => setMasterId(e.target.value)}
              className="input-field text-sm appearance-none">
              <option value="">— Не назначен —</option>
              {masters.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Услуги</label>
            {services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {services.map(s => (
                  <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2a2a] text-gray-300 text-xs rounded-full">
                    {s}
                    <button onClick={() => setServices(prev => prev.filter(x => x !== s))}
                      className="text-gray-500 hover:text-red-400 ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
                className="input-field text-sm appearance-none flex-1">
                <option value="">— Добавить услугу —</option>
                {availableServices.filter(s => !services.includes(s.name)).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <button onClick={addService} disabled={!selectedService}
                className="px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 disabled:opacity-40 transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
          <button onClick={() => { onSave(date, time, masterId || undefined, services); onClose() }}
            className="btn-orange flex-1 flex items-center justify-center gap-2">
            <Check size={16} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelModal({ apt, onClose, onConfirm }: { apt: Appointment; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Отмена записи</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="text-sm text-gray-400 mb-4">
          {apt.clientName} · {apt.carMake} {apt.carModel} · {apt.date.split('-').reverse().join('.')} {apt.time}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 font-medium">Причина отмены</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="input-field text-sm resize-none w-full"
            rows={3}
            placeholder="Укажите причину отмены..."
            autoFocus
          />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-outline flex-1">Назад</button>
          <button
            onClick={() => onConfirm(reason)}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-medium"
          >
            Отменить запись
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AppointmentsPage() {
  const { appointments, employees, updateAppointmentStatus, updateAppointment } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [dateFilter, setDateFilter] = useState('')
  const [completing, setCompleting] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [brandsMap, setBrandsMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    api.getCarBrands().then(d => {
      const map: Record<string, string | null> = {}
      d.forEach(b => { map[b.name] = b.image_url })
      setBrandsMap(map)
    }).catch(() => {})
  }, [])

  const filtered = appointments.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.clientName.toLowerCase().includes(q) ||
      a.licensePlate.toLowerCase().includes(q) ||
      a.carMake.toLowerCase().includes(q) || a.carModel.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const matchDate = !dateFilter || a.date === dateFilter
    return matchSearch && matchStatus && matchDate
  }).sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date)
    if (dateCompare !== 0) return dateCompare
    return b.time.localeCompare(a.time)
  })

  const showActions = statusFilter !== 'completed' && statusFilter !== 'cancelled'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Записи</h1>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4">
        {TAB_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Клиент, номер, авто..."
            className="input-field !pl-10 text-sm"
          />
        </div>
        <DatePicker value={dateFilter} onChange={setDateFilter} className="shrink-0 w-40" />
        {(search || dateFilter || statusFilter !== 'pending') && (
          <button onClick={() => { setSearch(''); setDateFilter(''); setStatusFilter('pending') }}
            className="px-3 text-gray-400 hover:text-white border border-[#2a2a2a] rounded-lg transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
                <th className="text-left px-4 py-3 font-medium">Дата / Время</th>
                <th className="text-left px-4 py-3 font-medium">Клиент</th>
                <th className="text-left px-4 py-3 font-medium">Автомобиль</th>
                <th className="text-left px-4 py-3 font-medium">Услуги</th>
                <th className="text-left px-4 py-3 font-medium">Мастер</th>
                <th className="text-left px-4 py-3 font-medium">Статус</th>
                {showActions && <th className="text-left px-4 py-3 font-medium">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(apt => {
                const master = employees.find(e => e.id === apt.masterId)
                return (
                  <tr key={apt.id} className="border-b border-[#1a1a1a] hover:bg-orange-500/10 hover:border-orange-500/20 transition-colors cursor-pointer"
                    onClick={() => setSelected(apt)}>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{apt.date.split('-').reverse().join('.')}</div>
                      <div className="text-gray-500 text-xs">{apt.time || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white">{apt.clientName}</div>
                      <div className="text-gray-500 text-xs whitespace-nowrap">{apt.clientPhone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{apt.carMake ? `${apt.carMake} ${apt.carModel} ${apt.carYear}` : '—'}</div>
                      <div className="text-gray-500 text-xs">{apt.licensePlate || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-400 text-xs max-w-[180px] truncate">
                        {apt.services.join(', ')}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {apt.status !== 'cancelled' && apt.status !== 'completed' ? (
                        <select
                          value={apt.masterId || ''}
                          onChange={e => updateAppointment(apt.id, { masterId: e.target.value || undefined })}
                          className="input-field text-xs py-1"
                        >
                          <option value="">— Не назначен —</option>
                          {employees.filter(e => e.isActive && ['master', 'admin', 'owner'].includes((e.role ?? '').toLowerCase())).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-gray-300 text-xs">{master?.name ?? '—'}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                        {STATUS_LABELS[apt.status]}
                      </span>
                      {apt.total ? <div className="text-green-400 text-xs mt-0.5">{apt.total.toLocaleString('ru-RU')} ₸</div> : null}
                    </td>
                    {showActions && <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {apt.status === 'pending' && (
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, 'in_progress')}
                            className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors whitespace-nowrap"
                          >
                            Подтвердить
                          </button>
                        )}
                        {apt.status === 'in_progress' && (
                          <button
                            onClick={() => setCompleting(apt)}
                            className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors whitespace-nowrap"
                          >
                            Завершить
                          </button>
                        )}
                        {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                          <button
                            onClick={e => { e.stopPropagation(); setEditing(apt) }}
                            className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-gray-400 rounded hover:text-white transition-colors whitespace-nowrap"
                          >
                            Изменить
                          </button>
                        )}
                        {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                          <button
                            onClick={() => setCancelling(apt)}
                            className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-600 py-10">Записей не найдено</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Детали записи</h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4 text-sm">
              {/* Блок 1: дата и статус */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Дата</div>
                  <div className="text-white">{selected.date.split('-').reverse().join('.')} {selected.time}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Статус</div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                </div>
              </div>

              <div className="border-t border-[#2a2a2a]" />

              {/* Блок 2: клиент и авто */}
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

              {/* Блок 3: услуги и масло */}
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
                {selected.total && (
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Итого</div>
                    <div className="text-green-400 font-semibold text-base">{selected.total.toLocaleString()} ₸</div>
                  </div>
                )}
              </div>

              {/* Блок 4: выполненные работы */}
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
                    {selected.serviceRecord.servicePrices && Object.keys(selected.serviceRecord.servicePrices).length > 0 && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Разбивка по услугам</div>
                        <div className="space-y-1.5">
                          {Object.entries(selected.serviceRecord.servicePrices).map(([service, price]) => (
                            <div key={service} className="flex justify-between items-center text-xs">
                              <span className="text-gray-400">{service}</span>
                              <span className="text-white font-medium">{price.toLocaleString('ru-RU')} ₸</span>
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

      {/* Complete modal */}
      {completing && (
        <CompleteModal
          apt={completing}
          onClose={() => setCompleting(null)}
          onSave={async (data) => { await updateAppointment(completing.id, data); setCompleting(null) }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          apt={editing}
          employees={employees}
          onClose={() => setEditing(null)}
          onSave={(date, time, masterId, services) => updateAppointment(editing.id, { date, time, masterId, services })}
        />
      )}

      {/* Cancel modal */}
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
