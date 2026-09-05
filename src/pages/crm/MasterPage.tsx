import { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import DatePicker from '../../components/DatePicker'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import type { Appointment } from '../../types'

const TODAY = new Date(Date.now() + 5 * 3600 * 1000).toISOString().split('T')[0]

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

function AppointmentCard({ apt, onStart, onComplete, onCancel }: {
  apt: Appointment
  onStart: () => void
  onComplete: (data: Partial<Appointment>) => void
  onCancel: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [oil, setOil] = useState('')
  const [viscosity, setViscosity] = useState('')
  const [liters, setLiters] = useState('')
  const [oilFilter, setOilFilter] = useState('')
  const [airFilter, setAirFilter] = useState('')
  const [cabinFilter, setCabinFilter] = useState('')
  const [freon, setFreon] = useState('')
  const [notes, setNotes] = useState('')
  const [servicePrices, setServicePrices] = useState<Record<string, string>>(
    Object.fromEntries((apt.services ?? []).map(s => [s, '']))
  )

  const total = Object.values(servicePrices).reduce((sum, p) => sum + (Number(p) || 0), 0)

  const allPricesFilled = (apt.services ?? []).length === 0 ||
    (apt.services ?? []).every(s => Number(servicePrices[s]) > 0)
  const canComplete = oil.trim() && viscosity.trim() && liters.trim() && oilFilter.trim() && allPricesFilled

  const handleComplete = () => {
    if (!canComplete) return
    const parsed = Object.fromEntries(Object.entries(servicePrices).map(([k, v]) => [k, Number(v) || 0]))
    onComplete({
      status: 'completed',
      total,
      serviceRecord: {
        oil: { brand: oil, viscosity, liters: Number(liters) },
        oilFilter, airFilter, cabinFilter, freon, notes, total,
        servicePrices: parsed,
      },
    })
  }

  const Input = ({ label, value, onChange, placeholder }: any) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="input-field text-sm" />
    </div>
  )

  return (
    <div className={`card p-4 ${apt.status === 'in_progress' ? 'border-orange-500/40' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold text-lg">{apt.time}</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
              {STATUS_LABELS[apt.status]}
            </span>
          </div>
          <div className="text-gray-300 font-medium">{apt.clientName}</div>
          <div className="text-gray-500 text-sm">{apt.clientPhone}</div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white transition-colors">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Car info */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 mb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-gray-500">Авто: </span><span className="text-white font-medium">{apt.carMake} {apt.carModel} {apt.carYear}</span></div>
          <div><span className="text-gray-500">Номер: </span><span className="text-orange-400 font-bold">{apt.licensePlate}</span></div>
          <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{apt.engineType} {apt.engineVolume}л</span></div>
          <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{apt.mileage.toLocaleString()} км</span></div>
        </div>
      </div>

      {/* Services */}
      <div className="mb-3">
        <div className="text-gray-500 text-xs mb-1.5">Услуги:</div>
        <div className="flex flex-wrap gap-1.5">
          {apt.services.map(s => (
            <span key={s} className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full">{s}</span>
          ))}
        </div>
      </div>

      <div className="mb-3 text-xs text-gray-400">
        <span className="text-gray-500">Масло: </span>{apt.oilPreference}
      </div>

      {apt.comment && (
        <div className="mb-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          📝 {apt.comment}
        </div>
      )}

      {/* Actions */}
      {apt.status !== 'completed' && apt.status !== 'cancelled' && (
        <div className="flex gap-2 mb-3">
          {apt.status === 'pending' && (
            <button onClick={onStart} className="btn-orange text-sm py-2 flex-1">
              В работу
            </button>
          )}
          {apt.status === 'in_progress' && (
            <button onClick={() => setExpanded(true)} className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm flex-1 hover:bg-green-500/30">
              Заполнить и завершить
            </button>
          )}
          <button onClick={onCancel} className="px-3 py-2 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-sm">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Expanded: completion form */}
      {expanded && apt.status === 'in_progress' && (
        <div className="border-t border-[#2a2a2a] pt-4 space-y-3">
          <div className="text-white font-medium text-sm mb-2">Заполните итоговые данные</div>
          <div className="grid grid-cols-3 gap-2">
            <Input label="Масло (бренд) *" value={oil} onChange={setOil} placeholder="Shell HX8" />
            <Input label="Вязкость *" value={viscosity} onChange={setViscosity} placeholder="5W-30" />
            <Input label="Литров *" value={liters} onChange={setLiters} placeholder="4.5" />
          </div>
          <Input label="Масляный фильтр *" value={oilFilter} onChange={setOilFilter} placeholder="MANN W712/95" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Воздушный фильтр" value={airFilter} onChange={setAirFilter} placeholder="MANN C25114/1" />
            <Input label="Салонный фильтр" value={cabinFilter} onChange={setCabinFilter} placeholder="MANN CU2939" />
          </div>
          <Input label="Фреон (кг)" value={freon} onChange={setFreon} placeholder="0.4" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field text-sm resize-none" rows={2}
              placeholder="Комментарий по состоянию авто..." />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2">Стоимость услуг *</label>
            <div className="space-y-2">
              {(apt.services ?? []).map(s => (
                <div key={s}>
                  <label className="block text-xs text-gray-500 mb-1">{s}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={servicePrices[s] ?? ''}
                      onChange={e => setServicePrices(prev => ({ ...prev, [s]: e.target.value }))}
                      className="input-field flex-1"
                      placeholder="Стоимость"
                    />
                    <span className="text-gray-500 text-sm shrink-0">₸</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#2a2a2a]">
              <span className="text-gray-400 text-sm font-medium">Итого</span>
              <span className="text-white font-bold">{total.toLocaleString('ru-RU')} ₸</span>
            </div>
          </div>
          <button onClick={handleComplete} disabled={!canComplete}
            className="btn-orange w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Check size={16} /> Завершить заказ
          </button>
        </div>
      )}

      {/* Completed view */}
      {apt.status === 'completed' && apt.serviceRecord && (
        <div className="border-t border-[#2a2a2a] pt-3 text-xs">
          {apt.serviceRecord.oil && (
            <div className="text-blue-400 mb-1">
              🛢️ {apt.serviceRecord.oil.brand} {apt.serviceRecord.oil.viscosity} · {apt.serviceRecord.oil.liters}л
            </div>
          )}
          {apt.serviceRecord.notes && <div className="text-yellow-400">📝 {apt.serviceRecord.notes}</div>}
          <div className="text-green-400 font-semibold mt-1">Итого: {apt.total?.toLocaleString()} ₸</div>
        </div>
      )}
    </div>
  )
}

export default function MasterPage() {
  const { appointments, updateAppointmentStatus, updateAppointment } = useApp()
  const { user } = useAuth()
  const [dateFilter, setDateFilter] = useState(TODAY)

  const masterId = user?.masterId ?? 'm1'
  const masterApts = appointments.filter(a => {
    const matchMaster = a.masterId === masterId
    const matchDate = !dateFilter || a.date === dateFilter
    return matchMaster && matchDate
  }).sort((a, b) => a.time.localeCompare(b.time))

  const done = masterApts.filter(a => a.status === 'completed').length

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Мои записи</h1>
        <p className="text-gray-500 text-sm">{user?.name}</p>
      </div>

      {/* Date picker + stats */}
      <div className="flex items-center gap-4 mb-5">
        <DatePicker value={dateFilter} onChange={setDateFilter} className="w-40" />
        <div className="text-gray-400 text-sm">
          {masterApts.length} записей · <span className="text-green-400">{done} выполнено</span>
        </div>
      </div>

      {masterApts.length === 0 ? (
        <div className="card p-10 text-center text-gray-600">
          Записей на выбранную дату нет
        </div>
      ) : (
        <div className="space-y-4">
          {masterApts.map(apt => (
            <AppointmentCard
              key={apt.id}
              apt={apt}
              onStart={() => updateAppointmentStatus(apt.id, 'in_progress')}
              onComplete={(data) => updateAppointment(apt.id, data)}
              onCancel={() => updateAppointmentStatus(apt.id, 'cancelled')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
