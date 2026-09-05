import { useState } from 'react'
import { Search, X, Building2, ChevronRight, FileText, Download, Plus, Pencil, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import type { CorporateClient, Car as CarType } from '../../types'

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

function CompanyDetail({ company, onClose, onEdit }: {
  company: CorporateClient
  onClose: () => void
  onEdit: () => void
}) {
  const [tab, setTab] = useState<'cars' | 'history' | 'report'>('cars')
  const [searchCar, setSearchCar] = useState('')

  const filteredCars = company.cars.filter(c => {
    const q = searchCar.toLowerCase()
    return !q || c.licensePlate.toLowerCase().includes(q) || c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q)
  })

  const allHistory = company.cars.flatMap(car =>
    car.serviceHistory.map(h => ({ ...h, car }))
  ).sort((a, b) => b.date.localeCompare(a.date))

  const totalOil = allHistory.reduce((s, h) => s + (h.oil?.liters ?? 0), 0)
  const totalAmount = allHistory.reduce((s, h) => s + h.total, 0)
  const totalFilters = allHistory.reduce((s, h) =>
    s + Object.values(h.filters).filter(Boolean).length, 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

        <div className="flex gap-1 mb-4 bg-[#111] p-1 rounded-lg">
          {(['cars', 'history', 'report'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${tab === t ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
              {{ cars: `Автомобили (${company.cars.length})`, history: 'История работ', report: 'Отчёт' }[t]}
            </button>
          ))}
        </div>

        {tab === 'cars' && (
          <div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchCar} onChange={e => setSearchCar(e.target.value)}
                placeholder="Поиск по номеру..." className="input-field !pl-10 text-xs" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#2a2a2a]">
                    <th className="text-left py-2 font-medium">Гос. номер</th>
                    <th className="text-left py-2 font-medium">Марка / Модель</th>
                    <th className="text-left py-2 font-medium">Пробег</th>
                    <th className="text-left py-2 font-medium">Посл. ТО</th>
                    <th className="text-left py-2 font-medium">След. ТО</th>
                    <th className="text-left py-2 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCars.map(car => (
                    <tr key={car.id} className="border-b border-[#1a1a1a]">
                      <td className="py-2 text-orange-400 font-bold">{car.licensePlate}</td>
                      <td className="py-2 text-gray-300">{car.make} {car.model} {car.year}</td>
                      <td className="py-2 text-gray-400">{car.mileage.toLocaleString()} км</td>
                      <td className="py-2 text-gray-400">{car.lastService ?? '—'}</td>
                      <td className="py-2 text-gray-400">{car.nextService ?? '—'}</td>
                      <td className={`py-2 font-medium ${STATUS_COLOR(car)}`}>{STATUS_TEXT(car)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <div className="text-green-400 font-bold text-sm">{totalAmount.toLocaleString()} ₸</div>
                <div className="text-gray-500 text-xs">Общая сумма</div>
              </div>
            </div>
            <div className="space-y-2">
              {allHistory.map((h, i) => (
                <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-orange-400 font-bold text-xs">{h.car.licensePlate}</span>
                      <span className="text-gray-500 text-xs ml-2">{h.car.make} {h.car.model}</span>
                    </div>
                    <div className="text-green-400 text-xs font-semibold">{h.total.toLocaleString()} ₸</div>
                  </div>
                  <div className="text-gray-500 text-xs">{h.date} · {h.mileage.toLocaleString()} км</div>
                  <div className="text-gray-400 text-xs mt-1">{h.services.join(', ')}</div>
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
                <div className="text-gray-500">Обслужено автомобилей: <span className="text-white">{company.cars.filter(c => c.serviceHistory.length > 0).length}</span></div>
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
  )
}

export default function CorporatePage({ corporateView }: Props) {
  const { corporateClients, addCorporate, updateCorporate } = useApp()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CorporateClient | null>(null)
  const [modal, setModal] = useState<'add' | CorporateClient | null>(null)

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
      await updateCorporate(modal.id, form)
      // Update selected if it was being viewed
      if (selected?.id === modal.id) {
        setSelected(prev => prev ? { ...prev, ...form } : null)
      }
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

      {!corporateView && (
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию компании..." className="input-field !pl-10 text-sm" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map(company => {
          const serviced = company.cars.filter(c => c.serviceHistory.length > 0).length
          const totalOil = company.cars.flatMap(c => c.serviceHistory).reduce((s, h) => s + (h.oil?.liters ?? 0), 0)
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
