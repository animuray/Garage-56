import { useState, useEffect, useCallback } from 'react'
import { Search, X, User, Car, Phone, ChevronRight, Star, Filter, SortAsc, Pencil, Trash2, Check } from 'lucide-react'
import type { Client, Appointment } from '../../types'
import { api } from '../../api'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { BrandLogo, CarFormModal, type CarData } from '../../components/CarFormModal'
import { formatPhone, isValidKZPhone } from '../../components/BookingModal'

const ENGINE_LABEL: Record<string, string> = {
  gasoline: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид', electric: 'Электро', gas: 'Газ',
}

const SORT_OPTIONS = [
  { value: '', label: 'По дате добавления' },
  { value: 'lastVisit', label: 'По последнему визиту' },
  { value: 'totalSpent', label: 'По сумме' },
  { value: 'visitCount', label: 'По посещениям' },
  { value: 'name', label: 'По имени' },
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает', confirmed: 'Подтверждено', in_progress: 'В работе',
  completed: 'Выполнено', cancelled: 'Отменено',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400', confirmed: 'text-blue-400', in_progress: 'text-orange-400',
  completed: 'text-green-400', cancelled: 'text-red-400',
}

function ClientEditModal({ client, onClose, onSave }: {
  client: Client | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const [carData, setCarData] = useState<CarData | null>(null)
  const [showCarForm, setShowCarForm] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [saving, setSaving] = useState(false)
  const isNew = !client

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
    if (phoneError && isValidKZPhone(formatted)) setPhoneError('')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (!isValidKZPhone(phone)) {
      setPhoneError('Введите корректный номер (+7 7XX ...)')
      return
    }
    setSaving(true)
    try {
      if (client) {
        await api.updateClient(client.id, { name, phone, email, notes })
      } else {
        const created = await api.createClient({ name, phone, email, notes }) as { id: string }
        if (carData && created?.id) {
          await api.createCar({
            clientId: created.id,
            make: carData.make, model: carData.model,
            year: Number(carData.year),
            engineType: carData.engineType, engineVolume: Number(carData.engineVolume),
            mileage: Number(carData.mileage) || 0,
            licensePlate: carData.licensePlate,
          })
        }
      }
      onSave()
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{isNew ? 'Новый клиент' : 'Редактировать клиента'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Имя <span className="text-orange-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Телефон <span className="text-orange-500">*</span></label>
            <input
              type="tel" value={phone} onChange={handlePhoneChange}
              onBlur={() => { if (phone && !isValidKZPhone(phone)) setPhoneError('Введите корректный номер (+7 7XX ...)') }}
              className={`input-field text-sm${phoneError ? ' border-red-500/60' : ''}`}
            />
            {phoneError && <p className="text-red-400 text-xs mt-1">{phoneError}</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="input-field text-sm" type="email" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Заметки</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field text-sm resize-none" rows={2} />
          </div>

          {isNew && (
            <div className="border-t border-[#2a2a2a] pt-3">
              <label className="block text-xs text-gray-400 mb-2">Автомобиль</label>
              {carData ? (
                <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#111]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <BrandLogo brand={carData.make} imageUrl={carData.makeImageUrl} size="sm" />
                    <span className="text-white text-sm font-medium">{carData.make} {carData.model}</span>
                    <button type="button" onClick={() => setShowCarForm(true)} className="ml-auto text-xs text-gray-500 hover:text-orange-400 transition-colors">изменить</button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{carData.year}</span></div>
                    <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{carData.engineType} {carData.engineVolume}л</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-medium">{carData.licensePlate}</span></div>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowCarForm(true)}
                  className="w-full border border-dashed border-[#2a2a2a] rounded-xl py-3 text-gray-500 hover:border-orange-500/40 hover:text-gray-300 transition-colors text-sm flex items-center justify-center gap-2">
                  <Car size={15} /> Добавить автомобиль
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !isValidKZPhone(phone)}
            className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Check size={16} /> Сохранить
          </button>
        </div>
      </div>
    </div>
    {showCarForm && (
      <CarFormModal
        initialData={carData ?? undefined}
        onSave={setCarData}
        onClose={() => setShowCarForm(false)}
      />
    )}
    </>
  )
}

function ClientDetail({ client, onClose, onEdit, onDelete, brandsMap }: {
  client: Client
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  brandsMap: Record<string, string | null>
}) {
  const [fullClient, setFullClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)

  useEffect(() => {
    api.getClient(client.id)
      .then(d => setFullClient(d as Client))
      .catch(() => setFullClient(client))
      .finally(() => setLoading(false))
  }, [client.id])

  const data = fullClient ?? client

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-orange-400 font-bold text-lg">
              {data.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-lg">{data.name}</h3>
                {data.isRegular && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-500/30">
                    <Star size={10} fill="currentColor" /> Постоянный
                  </span>
                )}
              </div>
              <div className="text-gray-500 text-xs flex items-center gap-1"><Phone size={11} />{data.phone}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#2a2a2a]"><Pencil size={15} /></button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10"><Trash2 size={15} /></button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-orange-400">{data.visitCount}</div>
            <div className="text-xs text-gray-500">Визитов</div>
          </div>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-400">{(data.totalSpent ?? 0).toLocaleString('ru-RU')}</div>
            <div className="text-xs text-gray-500">Потрачено ₸</div>
          </div>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
            <div className="text-sm font-semibold text-white">{data.firstVisit ? data.firstVisit.split('-').reverse().join('.') : '—'}</div>
            <div className="text-xs text-gray-500">Первый визит</div>
          </div>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-center">
            <div className="text-sm font-semibold text-white">{data.lastVisit ? data.lastVisit.split('-').reverse().join('.') : '—'}</div>
            <div className="text-xs text-gray-500">Последний визит</div>
          </div>
        </div>

        {data.email && (
          <div className="mb-3 text-sm text-gray-400">Email: <span className="text-white">{data.email}</span></div>
        )}
        {data.notes && (
          <div className="mb-4 text-sm bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-gray-300">{data.notes}</div>
        )}

        {loading && <div className="text-gray-600 text-sm text-center py-4">Загрузка...</div>}

        {/* Cars */}
        {data.cars.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2"><Car size={15} className="text-orange-500" /> Автомобили ({data.cars.length})</h4>
            <div className="space-y-2">
              {data.cars.map(car => (
                <div key={car.id} className="border border-[#2a2a2a] rounded-xl p-3 bg-[#0f0f0f]">
                  <div className="flex items-center gap-2.5 mb-2">
                    <BrandLogo brand={car.make} imageUrl={brandsMap[car.make]} size="sm" />
                    <span className="text-white text-sm font-medium">{car.make} {car.model}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{car.year}</span></div>
                    <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{ENGINE_LABEL[car.engineType] ?? car.engineType} {car.engineVolume}л</span></div>
                    <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{car.mileage.toLocaleString()} км</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-medium">{car.licensePlate}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appointment history */}
        {fullClient?.appointments && fullClient.appointments.length > 0 && (
          <div>
            <h4 className="text-white font-medium text-sm mb-2">История записей ({fullClient.appointments.length})</h4>
            <div className="space-y-1.5">
              {fullClient.appointments.map((apt: Appointment) => (
                <div key={apt.id} onClick={() => setSelectedApt(apt)}
                  className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors">
                  <div>
                    <div className="text-xs text-white">{apt.date.split('-').reverse().join('.')} · {apt.carMake} {apt.carModel}</div>
                    <div className="text-xs text-gray-500">{apt.services.join(', ') || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className={`text-xs font-medium ${STATUS_COLORS[apt.status]}`}>{STATUS_LABELS[apt.status]}</div>
                      {apt.total ? <div className="text-xs text-green-400">{apt.total.toLocaleString('ru-RU')} ₸</div> : null}
                    </div>
                    <ChevronRight size={13} className="text-gray-600 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Appointment detail modal */}
      {selectedApt && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedApt(null)}>
          <div className="card w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                  <span className={`text-xs font-medium ${STATUS_COLORS[selectedApt.status]}`}>{STATUS_LABELS[selectedApt.status]}</span>
                </div>
              </div>

              <div className="border-t border-[#2a2a2a]" />

              <div>
                <div className="text-gray-500 text-xs mb-2">Услуги</div>
                <div className="space-y-1">
                  {selectedApt.services.map(s => (
                    <div key={s} className="text-white text-sm flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">•</span>{s}
                    </div>
                  ))}
                </div>
              </div>

              {selectedApt.total && (
                <div className="flex justify-between items-center">
                  <div className="text-gray-500 text-xs">Итого</div>
                  <div className="text-green-400 font-semibold">{selectedApt.total.toLocaleString('ru-RU')} ₸</div>
                </div>
              )}

              {selectedApt.serviceRecord && (
                <>
                  <div className="border-t border-[#2a2a2a]" />
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Выполненные работы</div>
                    {selectedApt.serviceRecord.oil && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Масло</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-gray-500">Бренд: </span><span className="text-gray-200">{selectedApt.serviceRecord.oil.brand}</span></div>
                          <div><span className="text-gray-500">Вязкость: </span><span className="text-gray-200">{selectedApt.serviceRecord.oil.viscosity}</span></div>
                          <div><span className="text-gray-500">Объём: </span><span className="text-gray-200">{selectedApt.serviceRecord.oil.liters} л</span></div>
                        </div>
                      </div>
                    )}
                    {(selectedApt.serviceRecord.oilFilter || selectedApt.serviceRecord.airFilter || selectedApt.serviceRecord.cabinFilter) && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Фильтры</div>
                        <div className="space-y-1 text-xs">
                          {selectedApt.serviceRecord.oilFilter && <div><span className="text-gray-500">Масляный: </span><span className="text-gray-200">{selectedApt.serviceRecord.oilFilter}</span></div>}
                          {selectedApt.serviceRecord.airFilter && <div><span className="text-gray-500">Воздушный: </span><span className="text-gray-200">{selectedApt.serviceRecord.airFilter}</span></div>}
                          {selectedApt.serviceRecord.cabinFilter && <div><span className="text-gray-500">Салонный: </span><span className="text-gray-200">{selectedApt.serviceRecord.cabinFilter}</span></div>}
                        </div>
                      </div>
                    )}
                    {selectedApt.serviceRecord.servicePrices && Object.keys(selectedApt.serviceRecord.servicePrices).length > 0 && (
                      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-2">Разбивка по услугам</div>
                        <div className="space-y-1.5">
                          {Object.entries(selectedApt.serviceRecord.servicePrices).map(([service, price]) => (
                            <div key={service} className="flex justify-between items-center text-xs">
                              <span className="text-gray-400">{service}</span>
                              <span className="text-white font-medium">{price.toLocaleString('ru-RU')} ₸</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedApt.serviceRecord.notes && (
                      <div>
                        <div className="text-gray-500 text-xs mb-1">Замечания мастера</div>
                        <div className="text-gray-300 text-sm leading-relaxed">{selectedApt.serviceRecord.notes}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedApt.cancelReason && (
                <div>
                  <div className="text-gray-500 text-xs mb-1">Причина отмены</div>
                  <div className="text-red-400 text-sm">{selectedApt.cancelReason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isRegularFilter, setIsRegularFilter] = useState(false)
  const [sort, setSort] = useState('')
  const [selected, setSelected] = useState<Client | null>(null)
  const [editing, setEditing] = useState<Client | null | 'new'>()
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [brandsMap, setBrandsMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    api.getCarBrands().then(d => {
      const map: Record<string, string | null> = {}
      d.forEach(b => { map[b.name] = b.image_url })
      setBrandsMap(map)
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getClients({ search: search || undefined, isRegular: isRegularFilter || undefined, sort: sort || undefined })
      setClients(data as Client[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, isRegularFilter, sort])

  useEffect(() => { load() }, [load])

  const handleDelete = (client: Client) => {
    setConfirmDelete({
      message: `Удалить клиента ${client.name}? Записи останутся, но привязка будет удалена.`,
      onConfirm: async () => {
        await api.deleteClient(client.id)
        setSelected(null)
        load()
      }
    })
  }

  const regularCount = clients.filter(c => c.isRegular).length
  const totalSpent = clients.reduce((s, c) => s + (c.totalSpent ?? 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Клиенты</h1>
        <button
          onClick={() => setEditing('new')}
          className="btn-orange text-sm px-3 py-2 flex items-center gap-2"
        >
          <User size={15} /> Добавить
        </button>
      </div>

      {/* Summary stats — скрыто, раскомментировать чтобы вернуть
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card px-3 py-2.5 text-center">
          <div className="text-xl font-bold text-white">{clients.length}</div>
          <div className="text-xs text-gray-500">Всего</div>
        </div>
        <div className="card px-3 py-2.5 text-center">
          <div className="text-xl font-bold text-orange-400 flex items-center justify-center gap-1">
            <Star size={14} fill="currentColor" />{regularCount}
          </div>
          <div className="text-xs text-gray-500">Постоянных</div>
        </div>
        <div className="card px-3 py-2.5 text-center">
          <div className="text-sm font-bold text-green-400 leading-tight">{totalSpent.toLocaleString('ru-RU')} ₸</div>
          <div className="text-xs text-gray-500">Выручка</div>
        </div>
      </div>
      */}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Имя, телефон, email..."
            className={`input-field !pl-10 text-sm w-full${search ? ' !pr-8' : ''}`} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setIsRegularFilter(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${isRegularFilter ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-[#1a1a1a] text-gray-400 border-[#2a2a2a] hover:text-white'}`}
        >
          <Star size={13} fill={isRegularFilter ? 'currentColor' : 'none'} /> Постоянные
        </button>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="input-field text-sm appearance-none pr-8">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
                <th className="text-left px-4 py-3 font-medium">Клиент</th>
                <th className="text-left px-4 py-3 font-medium">Контакты</th>
                <th className="text-left px-4 py-3 font-medium">Визиты</th>
                <th className="text-left px-4 py-3 font-medium">Последний визит</th>
                <th className="text-left px-4 py-3 font-medium">Потрачено</th>
                <th className="text-left px-4 py-3 font-medium">Авто</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center text-gray-600 py-10">Загрузка...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-600 py-10">Клиентов не найдено</td></tr>
              ) : clients.map(client => (
                <tr key={client.id}
                  onClick={() => setSelected(client)}
                  className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-orange-400 text-sm font-medium flex-shrink-0">
                        {client.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium">{client.name}</span>
                          {client.isRegular && <Star size={11} className="text-orange-400" fill="currentColor" />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-300 text-xs flex items-center gap-1 whitespace-nowrap"><Phone size={11} />{client.phone}</div>
                    {client.email && <div className="text-gray-500 text-xs">{client.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${client.visitCount >= 3 ? 'text-orange-400' : 'text-white'}`}>
                      {client.visitCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-400 text-xs">{client.lastVisit ? client.lastVisit.split('-').reverse().join('.') : '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-green-400 text-sm font-medium">{(client.totalSpent ?? 0).toLocaleString('ru-RU')} ₸</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-gray-400 text-xs"><Car size={12} /> {client.cars.length}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-gray-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ClientDetail
          client={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null) }}
          onDelete={() => handleDelete(selected)}
          brandsMap={brandsMap}
        />
      )}

      {editing && (
        <ClientEditModal
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(undefined)}
          onSave={load}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.message}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
