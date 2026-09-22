import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, Users, Package, TrendingUp, Clock, Car, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { BrandLogo } from '../../components/CarFormModal'
import { api } from '../../api'
import DatePicker from '../../components/DatePicker'
import type { Appointment } from '../../types'
import { appointmentRowClass } from '../../utils/appointmentStyle'
import { OrderTag, TaxiMark } from '../../components/OrderTags'

// Compute current UTC+5 date on demand so it stays correct after midnight
const getToday = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().split('T')[0]
const getMonthStart = () => {
  const d = new Date(Date.now() + 5 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}
const fmtDate = (d: string) => d.split('-').reverse().join('.')

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

const PIE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6']

interface DashboardData {
  newClientsToday: number
  oilUsedToday: number
  avgCheckToday: number
  dailyRevenue: number
  weeklyRevenue: { day: string; orders: number; revenue: number }[]
  popularServices: { name: string; count: number; percent: number }[]
  oilBrands: { name: string; liters: number }[]
}

export default function DashboardPage() {
  const { appointments, employees } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dash_dateFrom') || '') || getMonthStart() } catch { return getMonthStart() }
  })
  const [dateTo, setDateTo] = useState(getToday)
  const [endPickerTrigger, setEndPickerTrigger] = useState(0)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [oilModal, setOilModal] = useState(false)
  const [servicesModal, setServicesModal] = useState(false)
  const [brandsMap, setBrandsMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    api.getCarBrands().then(d => {
      const map: Record<string, string | null> = {}
      d.forEach(b => { map[b.name] = b.image_url })
      setBrandsMap(map)
    }).catch(() => {})
  }, [])

  const today = getToday()
  const monthStart = getMonthStart()

  useEffect(() => {
    const refresh = () => api.getDashboard(dateFrom, dateTo).then(d => setData(d as DashboardData)).catch(console.error)
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const interval = setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    localStorage.setItem('dash_dateFrom', JSON.stringify(dateFrom))
  }, [dateFrom])


  const handleFromChange = (d: string) => {
    setDateFrom(d)
    if (d) setEndPickerTrigger(k => k + 1)
  }

  const rangeApts = appointments.filter(a => a.date >= dateFrom && a.date <= dateTo)
  const completed = rangeApts.filter(a => a.status === 'completed')
  const pending = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed')

  const rangeLabel = dateFrom === monthStart && dateTo === today
    ? 'Текущий месяц'
    : `${fmtDate(dateFrom)} — ${dateTo === today ? 'Сегодня' : fmtDate(dateTo)}`

  const StatCard = ({ icon, label, value, sub, color = 'text-white', onClick, className = '' }: any) => (
    <div className={`card p-4 ${onClick ? 'cursor-pointer hover:border-orange-500/30 transition-colors' : ''} ${className}`} onClick={onClick}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-gray-500 text-xs">{label}</span>
        <span className="text-gray-600">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${color} mb-0.5`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  )

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Дашборд</h1>
          <p className="text-gray-500 text-sm">Добро пожаловать, {user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={dateFrom} onChange={handleFromChange} className="w-36" maxDate={dateTo || today} placeholder="С" />
          <span className="text-gray-500 text-sm">—</span>
          <DatePicker value={dateTo} onChange={setDateTo} className="w-36" maxDate={today} minDate={dateFrom} triggerKey={endPickerTrigger} placeholder="По" />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-2">
        <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-medium">{rangeLabel}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div className="card p-4 col-span-2 sm:col-span-1">
            <div className="flex items-start justify-between mb-3">
              <span className="text-gray-500 text-xs">Записей за период</span>
              <span className="text-gray-500"><Calendar size={16} /></span>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <div className="text-2xl font-bold text-white leading-none">{rangeApts.length}</div>
                <div className="text-gray-600 text-xs mt-1">всего</div>
              </div>
              <div className="w-px h-8 bg-[#2a2a2a] self-center" />
              <div>
                <div className="text-2xl font-bold text-green-400 leading-none">{completed.length}</div>
                <div className="text-gray-600 text-xs mt-1">выполнено</div>
              </div>
            </div>
          </div>
          <StatCard icon={<Clock size={16} />} label="Ожидают" value={pending.length} sub="в очереди" color="text-yellow-400" />
          <StatCard icon={<Users size={16} />} label="Новых клиентов" value={data ? data.newClientsToday : '—'} sub="за период" color="text-blue-400" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={<TrendingUp size={16} />} label="Доход" value={data ? `${data.dailyRevenue.toLocaleString('ru-RU')} ₸` : '—'} sub="за период" color="text-green-400" />
          <StatCard icon={<Car size={16} />} label="Средний чек" value={data ? `${data.avgCheckToday.toLocaleString('ru-RU')} ₸` : '—'} sub="за период" color="text-orange-400" />
          <StatCard icon={<Package size={16} />} label="Использовано масла" value={data ? `${Number(data.oilUsedToday.toFixed(1))} л` : '—'} sub="за период" color="text-orange-400" onClick={() => setOilModal(true)} className="col-span-2 sm:col-span-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        {/* Revenue chart */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-4">Доход — {rangeLabel}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data?.weeklyRevenue ?? []}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}к`} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                labelStyle={{ color: '#fff', fontSize: 12 }}
                formatter={(v: number) => [`${v.toLocaleString('ru-RU')} ₸`, 'Доход']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Popular services */}
        <div className="card p-4 cursor-pointer hover:border-orange-500/30 transition-colors" onClick={() => setServicesModal(true)}>
          <h3 className="text-sm font-semibold text-white mb-4">Популярные услуги</h3>
          <div className="space-y-3">
            {(data?.popularServices ?? []).slice(0, 4).map(s => (
              <div key={s.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300 truncate pr-2">{s.name.replace('Замена ', '')}</span>
                  <span className="text-gray-500 flex-shrink-0">{s.percent}%</span>
                </div>
                <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${s.percent}%` }} />
                </div>
              </div>
            ))}
            {(data?.popularServices?.length ?? 0) > 4 && (
              <div className="text-xs text-orange-500 pt-1">Ещё {data!.popularServices.length - 4} услуг →</div>
            )}
          </div>
        </div>
      </div>

      {/* Today's appointments table */}
      <div className="card mt-4">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-semibold text-white">Записи — {rangeLabel}</h3>
          <button onClick={() => navigate('/crm/appointments')} className="text-xs text-orange-500 hover:text-orange-400">
            Все записи →
          </button>
        </div>
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#2a2a2a]">
          {rangeApts.map(apt => {
            const master = employees.find(e => e.id === apt.masterId)
            return (
              <div key={apt.id} onClick={() => setSelectedApt(apt)} className="p-4 cursor-pointer active:bg-orange-500/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{apt.time}</span>
                    <span className="text-gray-500 text-xs">{apt.date.split('-').reverse().join('.')}</span>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                    {STATUS_LABELS[apt.status]}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <TaxiMark apt={apt} />
                    <span className="text-white text-sm font-medium">{apt.clientName}</span>
                  </span>
                  <OrderTag apt={apt} />
                  {master && <span className="text-gray-500 text-xs">· {master.name}</span>}
                </div>
                {(apt.carMake || apt.licensePlate) && (
                  <div className="text-gray-400 text-xs mb-1">{apt.carMake} {apt.carModel}{apt.licensePlate ? ` · ${apt.licensePlate}` : ''}</div>
                )}
                {apt.services.length > 0 && (
                  <div className="text-gray-500 text-xs">{apt.services.slice(0, 2).join(', ')}{apt.services.length > 2 ? ` +${apt.services.length - 2}` : ''}</div>
                )}
              </div>
            )
          })}
          {rangeApts.length === 0 && (
            <div className="text-center text-gray-600 py-8">Записей нет</div>
          )}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[#2a2a2a]">
                <th className="text-left px-4 py-2.5 font-medium">Время</th>
                <th className="text-left px-4 py-2.5 font-medium">Клиент</th>
                <th className="text-left px-4 py-2.5 font-medium">Статус</th>
                <th className="text-left px-4 py-2.5 font-medium">Мастер</th>
                <th className="text-left px-4 py-2.5 font-medium">Автомобиль</th>
                <th className="text-left px-4 py-2.5 font-medium">Услуги</th>
              </tr>
            </thead>
            <tbody>
              {rangeApts.map(apt => {
                const master = employees.find(e => e.id === apt.masterId)
                return (
                  <tr key={apt.id} onClick={() => setSelectedApt(apt)} className={`border-b border-[#1a1a1a] ${appointmentRowClass(apt)} transition-colors cursor-pointer`}>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{apt.time}</div>
                      <div className="text-gray-500 text-xs">{apt.date.split('-').reverse().join('.')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white text-sm flex items-center gap-2"><TaxiMark apt={apt} />{apt.clientName}<OrderTag apt={apt} /></div>
                      <div className="text-gray-500 text-xs">{apt.clientPhone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                        {STATUS_LABELS[apt.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300 text-xs">{master?.name ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300 text-sm">{apt.carMake} {apt.carModel}</div>
                      <div className="text-gray-500 text-xs">{apt.licensePlate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-400 text-xs">{apt.services.slice(0, 2).join(', ')}{apt.services.length > 2 ? ` +${apt.services.length - 2}` : ''}</div>
                    </td>
                  </tr>
                )
              })}
              {rangeApts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-600 py-8">Записей на сегодня нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Services modal */}
      {servicesModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Популярные услуги</h3>
              <button onClick={() => setServicesModal(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {(data?.popularServices ?? []).map(s => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 truncate pr-2">{s.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-500">{s.count} раз</span>
                      <span className="text-orange-400 font-medium w-8 text-right">{s.percent}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${s.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Oil brands modal */}
      {oilModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Расход масел</h3>
              <button onClick={() => setOilModal(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            {(!data?.oilBrands?.length) ? (
              <div className="text-gray-500 text-sm text-center py-6">Нет данных за период</div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const maxLiters = Math.max(...data.oilBrands.map(o => o.liters), 1)
                  return data.oilBrands.map((o, i) => (
                    <div key={o.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{o.name}</span>
                        <span className="text-gray-500">{o.liters} л</span>
                      </div>
                      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${o.liters / maxLiters * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </div>
                  ))
                })()}
                <div className="text-xs text-gray-500 pt-1 border-t border-[#2a2a2a]">
                  Всего: {Number(data.oilUsedToday.toFixed(1))} л
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Appointment detail modal */}
      {selectedApt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Детали записи</h3>
              <button onClick={() => setSelectedApt(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Дата</div>
                  <div className="text-white">{selectedApt.date.split('-').reverse().join('.')} {selectedApt.time}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Статус</div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedApt.status]}`}>{STATUS_LABELS[selectedApt.status]}</span>
                </div>
              </div>
              <div className="border-t border-[#2a2a2a]" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500 text-xs mb-1">Клиент</div>
                  <div className="text-white">{selectedApt.clientName}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">Телефон</div>
                  <div className="text-white">{selectedApt.clientPhone}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 text-xs mb-1">Автомобиль</div>
                  {selectedApt.carMake ? (
                    <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#0f0f0f]">
                      <div className="flex items-center gap-2.5 mb-2">
                        <BrandLogo brand={selectedApt.carMake} imageUrl={brandsMap[selectedApt.carMake]} size="sm" />
                        <span className="text-white text-sm font-medium">{selectedApt.carMake} {selectedApt.carModel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{selectedApt.carYear}</span></div>
                        <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{selectedApt.engineType} {selectedApt.engineVolume}л</span></div>
                        <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{selectedApt.mileage?.toLocaleString()} км</span></div>
                        {selectedApt.licensePlate && <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-medium">{selectedApt.licensePlate}</span></div>}
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
                    {selectedApt.services.map(s => (
                      <div key={s} className="text-white text-sm flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
                {selectedApt.oilPreference && (
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Масло</div>
                    <div className="text-white">{selectedApt.oilPreference}</div>
                  </div>
                )}
                {(() => {
                  const master = employees.find(e => e.id === selectedApt.masterId)
                  return master ? (
                    <div>
                      <div className="text-gray-500 text-xs mb-1">Мастер</div>
                      <div className="text-white">{master.name}</div>
                    </div>
                  ) : null
                })()}
                {selectedApt.comment && (
                  <div className="mt-2 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <div className="text-gray-500 text-xs mb-1.5">Комментарий</div>
                    <div className="text-gray-200 text-sm leading-relaxed">{selectedApt.comment}</div>
                  </div>
                )}
                {selectedApt.cancelReason && (
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Причина отмены</div>
                    <div className="text-red-400">{selectedApt.cancelReason}</div>
                  </div>
                )}
                {selectedApt.total && (
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Итого</div>
                    <div className="text-green-400 font-semibold text-base">{selectedApt.total.toLocaleString()} ₸</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
