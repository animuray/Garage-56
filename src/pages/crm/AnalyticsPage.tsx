import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../../api'
import DatePicker from '../../components/DatePicker'

const getToday = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().split('T')[0]
const getMonthStart = () => {
  const d = new Date(Date.now() + 5 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}
const fmtDate = (d: string) => d.split('-').reverse().join('.')

const ORANGE_SHADES = ['#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12']
const PIE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#64748b']

const fmt = (n: number) => n.toLocaleString('ru-RU')

interface AnalyticsData {
  summary: {
    totalRevenue: number
    avgCheck: number
    totalOrders: number
    totalClients: number
    newClients: number
    repeatClients: number
    oilUsed: number
    filtersChanged: number
  }
  monthlyRevenue: { month: string; revenue: number }[]
  weeklyRevenue: { day: string; orders: number; revenue: number }[]
  popularServices: { name: string; count: number; percent: number }[]
  popularMakes: { name: string; count: number }[]
  oilBrands: { name: string; liters: number }[]
  masters: { name: string; orders: number }[]
}

const StatCard = ({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="card p-4">
    <div className="text-gray-500 text-xs mb-1">{label}</div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {sub && <div className="text-gray-600 text-xs mt-0.5">{sub}</div>}
  </div>
)

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    try { return JSON.parse(localStorage.getItem('analytics_dateFrom') || '') || getMonthStart() } catch { return getMonthStart() }
  })
  const [dateTo, setDateTo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('analytics_dateTo') || '') || getToday() } catch { return getToday() }
  })
  const [endPickerTrigger, setEndPickerTrigger] = useState(0)

  const today = getToday()

  useEffect(() => {
    localStorage.setItem('analytics_dateFrom', JSON.stringify(dateFrom))
  }, [dateFrom])

  useEffect(() => {
    localStorage.setItem('analytics_dateTo', JSON.stringify(dateTo))
  }, [dateTo])

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getAnalytics(dateFrom, dateTo)
      .then(d => setData(d as AnalyticsData))
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  const handleFromChange = (d: string) => {
    setDateFrom(d)
    if (d) setEndPickerTrigger(k => k + 1)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">Загрузка...</div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-64 text-red-400">
      {error || 'Не удалось загрузить данные'}
    </div>
  )

  const { summary, monthlyRevenue, weeklyRevenue, popularServices, popularMakes, oilBrands, masters } = data
  const maxOilLiters = Math.max(...oilBrands.map(o => o.liters), 1)
  const maxMasterOrders = Math.max(...masters.map(m => m.orders), 1)
  const newPct = summary.totalClients > 0 ? Math.round(summary.newClients / summary.totalClients * 100) : 0

  return (
    <div>
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Аналитика</h1>
          <p className="text-gray-500 text-sm">{fmtDate(dateFrom)} — {dateTo === today ? 'Сегодня' : fmtDate(dateTo)}</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker value={dateFrom} onChange={handleFromChange} className="w-36" maxDate={dateTo || today} placeholder="С" />
          <span className="text-gray-500 text-sm">—</span>
          <DatePicker value={dateTo} onChange={setDateTo} className="w-36" maxDate={today} minDate={dateFrom} triggerKey={endPickerTrigger} placeholder="По" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Общая выручка"      value={`${fmt(summary.totalRevenue)} ₸`}  color="text-green-400" />
        <StatCard label="Средний чек"        value={`${fmt(summary.avgCheck)} ₸`}       color="text-orange-400" />
        <StatCard label="Всего клиентов"     value={fmt(summary.totalClients)} />
        <StatCard label="Новых клиентов"     value={summary.newClients}  sub="за период" color="text-blue-400" />
        <StatCard label="Выполнено заказов"  value={fmt(summary.totalOrders)} />
        <StatCard label="Повторных клиентов" value={summary.repeatClients}
          sub={summary.totalClients > 0 ? `${Math.round(summary.repeatClients / summary.totalClients * 100)}%` : '0%'}
          color="text-purple-400" />
        <StatCard label="Использовано масла" value={`${summary.oilUsed} л`}  color="text-cyan-400" />
        <StatCard label="Сменено фильтров"   value={summary.filtersChanged} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Monthly revenue */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Выручка по месяцам за период (₸)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="monthRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}к`} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                formatter={(v: number) => [`${fmt(v)} ₸`, 'Выручка']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#monthRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly orders */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Заказы за период</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="day" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                formatter={(v: number, name: string) => [
                  name === 'orders' ? `${v} заказов` : `${fmt(v)} ₸`,
                  name === 'orders' ? 'Заказы' : 'Выручка',
                ]}
              />
              <Bar dataKey="orders" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Popular services */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Популярные услуги</h3>
          {popularServices.length === 0
            ? <div className="text-gray-500 text-sm text-center py-8">Нет данных</div>
            : <div className="space-y-3">
                {popularServices.map((s, i) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-300">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{s.count} раз</span>
                        <span className="text-orange-400 font-medium w-8 text-right">{s.percent}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.percent}%`, background: ORANGE_SHADES[i] ?? '#f97316' }} />
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Popular makes */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Популярные марки авто</h3>
          {popularMakes.length === 0
            ? <div className="text-gray-500 text-sm text-center py-8">Нет данных</div>
            : <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={popularMakes} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                      {popularMakes.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#e5e7eb' }}
                      labelStyle={{ color: '#9ca3af' }}
                      itemStyle={{ color: '#e5e7eb' }}
                      formatter={(v: number, name: string) => [`${v} авт.`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {popularMakes.map((make, i) => (
                    <div key={make.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-300">{make.name}</span>
                      </div>
                      <span className="text-gray-500">{make.count}</span>
                    </div>
                  ))}
                </div>
              </div>
          }
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Clients */}
        <div className="card p-4">
          <h4 className="text-white text-sm font-semibold mb-3">Клиенты</h4>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Всего</span>
              <span className="text-white font-medium">{fmt(summary.totalClients)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Новые (период)</span>
              <span className="text-blue-400 font-medium">{summary.newClients}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Повторные</span>
              <span className="text-green-400 font-medium">{summary.repeatClients}</span>
            </div>
            {summary.totalClients > 0 && (
              <>
                <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500" style={{ width: `${newPct}%` }} />
                  <div className="h-full bg-green-500 flex-1" />
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded inline-block" />Новые {newPct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded inline-block" />Пост. {100 - newPct}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Oil brands */}
        <div className="card p-4">
          <h4 className="text-white text-sm font-semibold mb-3">Расход масел</h4>
          {oilBrands.length === 0
            ? <div className="text-gray-500 text-sm text-center py-4">Нет данных</div>
            : <div className="space-y-2">
                {oilBrands.map((o, i) => (
                  <div key={o.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{o.name}</span>
                      <span className="text-gray-500">{o.liters} л</span>
                    </div>
                    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${o.liters / maxOilLiters * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                  </div>
                ))}
                <div className="text-xs text-gray-500 pt-1">Всего: {summary.oilUsed} л</div>
              </div>
          }
        </div>

        {/* Masters workload */}
        <div className="card p-4">
          <h4 className="text-white text-sm font-semibold mb-3">Загрузка мастеров</h4>
          {masters.length === 0
            ? <div className="text-gray-500 text-sm text-center py-4">Нет данных</div>
            : <div className="space-y-3">
                {masters.map((m, i) => (
                  <div key={m.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{m.name}</span>
                      <span className="text-gray-500">{m.orders} зак.</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${m.orders / maxMasterOrders * 100}%`, background: ORANGE_SHADES[i] ?? '#f97316' }} />
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
