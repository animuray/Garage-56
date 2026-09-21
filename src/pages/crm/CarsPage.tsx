import { useState, useEffect } from 'react'
import { Search, X, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, Car as CarIcon, Archive, ArchiveRestore } from 'lucide-react'
import { ActionDialog, CarSummary } from '../../components/ActionDialog'
import { useApp } from '../../context/AppContext'
import type { Car as CarType, EngineType } from '../../types'
import { BrandPickerModal, BrandLogo, ModelPickerModal } from '../../components/CarFormModal'
import { PlateInput } from '../../components/PlateInput'
import { api } from '../../api'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

const ENGINE_OPTIONS: { value: EngineType; label: string }[] = [
  { value: 'gasoline', label: 'Бензин' },
  { value: 'electric', label: 'Электро' },
  { value: 'gas', label: 'Газ' },
  { value: 'diesel', label: 'Дизель' },
  { value: 'hybrid', label: 'Гибрид' },
]
const ENGINE_LABEL: Record<string, string> = {
  gasoline: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид', electric: 'Электро', gas: 'Газ',
}

function CarDetail({ car, onClose, onEdit, onDelete }: {
  car: CarType & { ownerName: string }
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const nextServiceDays = car.nextService
    ? Math.ceil((new Date(car.nextService).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-lg">{car.make} {car.model} {car.year}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-gray-500 text-xs">Гос. номер</div><div className="text-orange-400 font-bold text-base">{car.licensePlate}</div></div>
            <div><div className="text-gray-500 text-xs">Пробег</div><div className="text-white font-semibold">{car.mileage.toLocaleString()} км</div></div>
            <div><div className="text-gray-500 text-xs">Двигатель</div><div className="text-white">{ENGINE_LABEL[car.engineType]} {car.engineVolume}л</div></div>
            <div><div className="text-gray-500 text-xs">Владелец</div><div className="text-white">{car.ownerName}</div></div>
            {car.vin && <div className="col-span-2"><div className="text-gray-500 text-xs">VIN</div><div className="text-white text-xs font-mono">{car.vin}</div></div>}
            {car.lastService && <div><div className="text-gray-500 text-xs">Последнее ТО</div><div className="text-white">{car.lastService}</div></div>}
            {car.nextService && (
              <div>
                <div className="text-gray-500 text-xs">Следующее ТО</div>
                <div className={nextServiceDays !== null && nextServiceDays < 30 ? 'text-orange-400 font-medium' : 'text-white'}>
                  {car.nextService}
                  {nextServiceDays !== null && nextServiceDays < 30 && ` (через ${nextServiceDays} дн.)`}
                </div>
              </div>
            )}
          </div>
        </div>

        <h4 className="text-white font-medium text-sm mb-3">История обслуживания ({car.serviceHistory.length})</h4>
        {car.serviceHistory.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-4">История пуста</div>
        ) : (
          <div className="space-y-3">
            {car.serviceHistory.map(h => (
              <div key={h.id} className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-medium text-sm">{h.date}</div>
                  <div className="text-green-400 font-semibold text-sm">{h.total.toLocaleString()} ₸</div>
                </div>
                <div className="text-gray-500 text-xs mb-2">Пробег: {h.mileage.toLocaleString()} км · Мастер: {h.masterName}</div>
                <div className="space-y-0.5 mb-2">
                  {h.services.map(s => (
                    <div key={s} className="text-gray-300 text-xs flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-orange-500 rounded-full inline-block" />{s}
                    </div>
                  ))}
                </div>
                {h.oil && <div className="text-blue-400 text-xs">🛢️ {h.oil.brand} {h.oil.viscosity} · {h.oil.liters}л</div>}
                {(h.filters.oil || h.filters.air || h.filters.cabin || h.filters.fuel) && (
                  <div className="text-gray-500 text-xs mt-1">
                    Фильтры: {[h.filters.oil, h.filters.air, h.filters.cabin, h.filters.fuel].filter(Boolean).join(', ')}
                  </div>
                )}
                {h.masterNotes && <div className="text-yellow-400 text-xs mt-1">📝 {h.masterNotes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type CarForm = Omit<CarType, 'id' | 'serviceHistory'>

const FInput = ({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string
}) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1 font-medium">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="input-field text-sm" />
  </div>
)

function CarModal({ car, clients, corporateClients, onClose, onSave }: {
  car?: CarType & { ownerName: string }
  clients: { id: string; name: string }[]
  corporateClients: { id: string; companyName: string }[]
  onClose: () => void
  onSave: (form: CarForm) => Promise<void>
}) {
  const [ownerType, setOwnerType] = useState<'client' | 'corporate'>(
    car?.corporateId ? 'corporate' : 'client'
  )
  const [form, setForm] = useState<CarForm>({
    clientId: car?.clientId,
    corporateId: car?.corporateId,
    make: car?.make ?? '',
    model: car?.model ?? '',
    year: car?.year ?? new Date().getFullYear(),
    engineType: car?.engineType ?? 'gasoline',
    engineVolume: car?.engineVolume ?? 2.0,
    licensePlate: car?.licensePlate ?? '',
    mileage: car?.mileage ?? 0,
    lastService: car?.lastService ?? undefined,
    nextService: car?.nextService ?? undefined,
  })
  const [showBrandPicker, setShowBrandPicker] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [makeImageUrl, setMakeImageUrl] = useState<string | null>(null)
  const [makeId, setMakeId] = useState<number | null>(null)
  const [availableModels, setAvailableModels] = useState<{ id: number; name: string; imageUrl: string | null }[]>([])
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [engineTypeOpen, setEngineTypeOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const YEARS = Array.from({ length: new Date().getFullYear() - 1959 }, (_, i) => new Date().getFullYear() - i)

  useEffect(() => {
    if (!makeId) { setAvailableModels([]); return }
    fetch(`${API_BASE}/api/car-models?brandId=${makeId}`)
      .then(r => r.json())
      .then(d => setAvailableModels(Array.isArray(d) ? d : []))
      .catch(() => setAvailableModels([]))
  }, [makeId])

  const set = (k: keyof CarForm) => (v: string) => setForm(p => ({
    ...p,
    [k]: ['year', 'mileage', 'engineVolume'].includes(k) ? Number(v) : (v || undefined),
  }))

  const handleSave = async () => {
    if (!form.make || !form.model || !form.licensePlate) {
      setError('Укажите марку, модель и гос. номер')
      return
    }
    const payload: CarForm = {
      ...form,
      clientId: ownerType === 'client' ? form.clientId : undefined,
      corporateId: ownerType === 'corporate' ? form.corporateId : undefined,
    }
    setSaving(true)
    setError('')
    try {
      await onSave(payload)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{car ? 'Редактировать автомобиль' : 'Добавить автомобиль'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {/* Owner */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Тип владельца</label>
            <div className="flex gap-2">
              {(['client', 'corporate'] as const).map(t => (
                <button key={t} onClick={() => setOwnerType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${ownerType === t ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}>
                  {t === 'client' ? 'Физическое лицо' : 'Компания'}
                </button>
              ))}
            </div>
          </div>
          {ownerType === 'client' ? (
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Клиент</label>
              <select value={form.clientId ?? ''} onChange={e => setForm(p => ({ ...p, clientId: e.target.value || undefined }))}
                className="input-field text-sm">
                <option value="">— Не привязан —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Компания</label>
              <select value={form.corporateId ?? ''} onChange={e => setForm(p => ({ ...p, corporateId: e.target.value || undefined }))}
                className="input-field text-sm">
                <option value="">— Не привязана —</option>
                {corporateClients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
          )}

          {/* Make */}
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Марка *</label>
            <button
              type="button"
              onClick={() => setShowBrandPicker(true)}
              className="input-field w-full flex items-center gap-2"
            >
              {form.make ? (
                <>
                  <BrandLogo brand={form.make} imageUrl={makeImageUrl} size="sm" />
                  <span className="text-white text-sm">{form.make}</span>
                </>
              ) : (
                <span className="text-gray-500 text-sm">Выберите марку</span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Модель *</label>
              {availableModels.length > 0 ? (
                <button type="button" onClick={() => setShowModelPicker(true)}
                  className="input-field w-full flex items-center gap-2 text-sm">
                  {form.model ? (
                    <>
                      {modelImageUrl
                        ? <img src={modelImageUrl} alt={form.model} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                        : <CarIcon size={14} className="text-gray-500 flex-shrink-0" />}
                      <span className="text-white">{form.model}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Выберите модель</span>
                  )}
                </button>
              ) : (
                <input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
                  className="input-field text-sm" placeholder="Выберите модель" />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Тип двигателя</label>
              <div className="relative">
                <button type="button" onClick={() => setEngineTypeOpen(o => !o)}
                  className="input-field w-full flex items-center justify-between text-sm">
                  <span className="text-white">{ENGINE_LABEL[form.engineType] ?? form.engineType}</span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${engineTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                {engineTypeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden z-10 shadow-xl">
                    {ENGINE_OPTIONS.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => { setForm(p => ({ ...p, engineType: o.value })); setEngineTypeOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          form.engineType === o.value ? 'bg-orange-500/20 text-orange-400' : 'text-gray-300 hover:bg-[#222] hover:text-white'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Год</label>
              <div className="relative">
                <button type="button" onClick={() => setYearOpen(o => !o)}
                  className="input-field w-full flex items-center justify-between text-sm">
                  <span className="text-white">{form.year}</span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
                </button>
                {yearOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-y-auto z-20 shadow-xl" style={{ maxHeight: '240px' }}>
                    {YEARS.map(y => (
                      <button key={y} type="button"
                        onClick={() => { setForm(p => ({ ...p, year: y })); setYearOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          form.year === y ? 'bg-orange-500/20 text-orange-400' : 'text-gray-300 hover:bg-[#222] hover:text-white'
                        }`}>
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <PlateInput value={form.licensePlate ?? ''} onChange={v => setForm(p => ({ ...p, licensePlate: v }))} required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Объём (л)</label>
              <input type="number" step="0.1" min="0.1" max="7.3" value={form.engineVolume}
                onChange={e => setForm(p => ({ ...p, engineVolume: Number(e.target.value) }))}
                onBlur={() => setForm(p => ({ ...p, engineVolume: Math.min(7.3, Math.max(0.1, p.engineVolume)) }))}
                className="input-field text-sm" placeholder="2.0" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-medium">Пробег (км)</label>
              <input type="number" min="0" max="1000000" value={form.mileage}
                onChange={e => setForm(p => ({ ...p, mileage: Number(e.target.value) }))}
                onBlur={() => setForm(p => ({ ...p, mileage: Math.min(1000000, Math.max(0, p.mileage)) }))}
                className="input-field text-sm" placeholder="0" />
            </div>
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

      {showBrandPicker && (
        <BrandPickerModal
          onSelect={(name, imgUrl, brandId) => { setForm(p => ({ ...p, make: name, model: '' })); setMakeImageUrl(imgUrl ?? null); setMakeId(brandId ?? null); setModelImageUrl(null); setShowBrandPicker(false) }}
          onClose={() => setShowBrandPicker(false)}
          zIndex="z-[60]"
        />
      )}

      {showModelPicker && makeId && (
        <ModelPickerModal
          brandId={makeId}
          onSelect={(name, imgUrl) => { setForm(p => ({ ...p, model: name })); setModelImageUrl(imgUrl ?? null); setShowModelPicker(false) }}
          onClose={() => setShowModelPicker(false)}
          zIndex="z-[70]"
        />
      )}
    </div>
  )
}

// Deleted cars live here: nothing is removed from the database, only hidden from the fleet lists.
function ArchiveList({ cars, onRestore }: { cars: CarType[]; onRestore: (car: CarType) => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a2a] text-xs text-gray-500">
        Удалённые автомобили. Вся история обслуживания и траты по ним сохранены и входят в отчёты. Госномер остаётся занятым — чтобы вернуть автомобиль, его нужно восстановить.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
              <th className="text-left px-4 py-3 font-medium">Гос. номер</th>
              <th className="text-left px-4 py-3 font-medium">Автомобиль</th>
              <th className="text-left px-4 py-3 font-medium">Владелец</th>
              <th className="text-left px-4 py-3 font-medium">В архиве с</th>
              <th className="text-left px-4 py-3 font-medium">История</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cars.map(car => (
              <tr key={car.id} className="border-b border-[#1a1a1a]">
                <td className="px-4 py-3 text-orange-400 font-bold">{car.licensePlate}</td>
                <td className="px-4 py-3 text-white">{car.make} {car.model} <span className="text-gray-500 text-xs">{car.year}</span></td>
                <td className="px-4 py-3 text-gray-300">{car.ownerName || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{car.archivedAt ? new Date(car.archivedAt).toLocaleDateString('ru-RU') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${car.serviceHistory.length > 0 ? 'text-green-400' : 'text-gray-600'}`}>{car.serviceHistory.length} зап.</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onRestore(car)}
                    className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors">
                    Восстановить
                  </button>
                </td>
              </tr>
            ))}
            {cars.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-600 py-10">В архиве пусто</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CarsPage() {
  const { clients, corporateClients, addCar, updateCar, deleteCar, refreshData } = useApp()
  const [view, setView] = useState<'active' | 'archive'>('active')
  const [archived, setArchived] = useState<CarType[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<(CarType & { ownerName: string }) | null>(null)
  const [modal, setModal] = useState<'add' | (CarType & { ownerName: string }) | null>(null)
  const [deleting, setDeleting] = useState<CarType | null>(null)
  const [brandsMap, setBrandsMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    api.getCarBrands().then(d => {
      const map: Record<string, string | null> = {}
      d.forEach(b => { map[b.name] = b.image_url })
      setBrandsMap(map)
    }).catch(() => {})
  }, [])

  const allCars: (CarType & { ownerName: string })[] = [
    ...clients.flatMap(c => c.cars.map(car => ({ ...car, ownerName: c.name }))),
    ...corporateClients.flatMap(cc => cc.cars.map(car => ({ ...car, ownerName: cc.companyName }))),
  ]

  const filtered = allCars.filter(car => {
    const q = search.toLowerCase()
    return !q ||
      car.make.toLowerCase().includes(q) ||
      car.model.toLowerCase().includes(q) ||
      car.licensePlate.toLowerCase().includes(q) ||
      (car.vin ?? '').toLowerCase().includes(q) ||
      car.ownerName.toLowerCase().includes(q)
  })

  const needService = allCars.filter(c => {
    if (!c.nextService) return false
    return Math.ceil((new Date(c.nextService).getTime() - Date.now()) / 86400000) < 30
  }).length

  const loadArchive = () => api.getArchivedCars().then(setArchived).catch(() => {})
  useEffect(() => { loadArchive() }, [])

  const restore = async (carId: string) => {
    await api.restoreCar(carId)
    await Promise.all([refreshData(), loadArchive()])
  }

  // A plate that belongs to an archived car can't be added again: offer to restore that car instead of creating a copy
  const [restoring, setRestoring] = useState<CarType | null>(null)
  const [plateConflict, setPlateConflict] = useState<{ carId: string; label: string; plate: string } | null>(null)
  const noteArchivedPlate = (e: unknown, plate: string) => {
    const err = e as { code?: string; data?: { carId?: string; label?: string } }
    if (err?.code === 'CAR_ARCHIVED' && err.data?.carId) setPlateConflict({ carId: err.data.carId, label: err.data.label ?? '', plate })
  }

  const handleSave = async (form: CarForm) => {
    try {
      if (modal === 'add') {
        await addCar(form)
      } else if (modal) {
        await updateCar(modal.id, form)
        setSelected(null)
      }
    } catch (e) {
      noteArchivedPlate(e, form.licensePlate)   // the form stays open and shows the server's message
      throw e
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    await deleteCar(deleting.id)   // moves the car to the archive
    await loadArchive()
    setDeleting(null)
    setSelected(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Автомобили</h1>
        <button onClick={() => setModal('add')} className="btn-orange flex items-center gap-2 text-sm">
          <Plus size={15} /> Добавить
        </button>
      </div>

      <div className="flex gap-1 mb-4 bg-[#111] p-1 rounded-lg w-fit">
        <button onClick={() => setView('active')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'active' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
          Автомобили ({allCars.length})
        </button>
        <button onClick={() => { setView('archive'); loadArchive() }}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'archive' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}>
          Архив ({archived.length})
        </button>
      </div>

      {view === 'active' && needService > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3 mb-4 flex items-center gap-2 text-sm text-orange-400">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          {needService} {needService === 1 ? 'автомобилю' : 'автомобилям'} скоро требуется ТО (менее 30 дней)
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Марка, модель, гос. номер, VIN, владелец..."
            className="input-field !pl-10 text-sm" />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="px-3 text-gray-400 hover:text-white border border-[#2a2a2a] rounded-lg">
            <X size={16} />
          </button>
        )}
      </div>

      {view === 'archive' && (
        <ArchiveList
          cars={archived.filter(car => {
            const q = search.toLowerCase()
            return !q || car.make.toLowerCase().includes(q) || car.model.toLowerCase().includes(q) ||
              car.licensePlate.toLowerCase().includes(q) || (car.ownerName ?? '').toLowerCase().includes(q)
          })}
          onRestore={(car) => setRestoring(car)}
        />
      )}

      {view === 'active' && (
      <div className="card overflow-hidden">
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#2a2a2a]">
          {filtered.map(car => {
            const nextDays = car.nextService
              ? Math.ceil((new Date(car.nextService).getTime() - Date.now()) / 86400000)
              : null
            const soonService = nextDays !== null && nextDays < 30
            return (
              <div key={car.id} onClick={() => setSelected(car)} className="p-4 cursor-pointer active:bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <BrandLogo brand={car.make} imageUrl={brandsMap[car.make]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-white font-medium text-sm">{car.make} {car.model}</span>
                      <span className="text-orange-400 font-bold text-sm">{car.licensePlate}</span>
                    </div>
                    <div className="text-gray-500 text-xs">{car.year} · {ENGINE_LABEL[car.engineType]} {car.engineVolume}л · {car.ownerName}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs flex-wrap">
                  <span className="text-gray-400">{car.mileage.toLocaleString()} км</span>
                  {soonService && <span className="text-orange-400">ТО скоро ⚠️</span>}
                  <span className={car.serviceHistory.length > 0 ? 'text-green-400' : 'text-gray-600'}>{car.serviceHistory.length} зап.</span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-10">Автомобилей не найдено</div>
          )}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
                <th className="text-left px-4 py-3 font-medium">Гос. номер</th>
                <th className="text-left px-4 py-3 font-medium">Автомобиль</th>
                <th className="text-left px-4 py-3 font-medium">Владелец</th>
                <th className="text-left px-4 py-3 font-medium">Пробег</th>
                <th className="text-left px-4 py-3 font-medium">Посл. ТО</th>
                <th className="text-left px-4 py-3 font-medium">След. ТО</th>
                <th className="text-left px-4 py-3 font-medium">История</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(car => {
                const nextDays = car.nextService
                  ? Math.ceil((new Date(car.nextService).getTime() - Date.now()) / 86400000)
                  : null
                const soonService = nextDays !== null && nextDays < 30
                return (
                  <tr key={car.id}
                    onClick={() => setSelected(car)}
                    className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="text-orange-400 font-bold text-sm">{car.licensePlate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BrandLogo brand={car.make} imageUrl={brandsMap[car.make]} size="sm" />
                        <div>
                          <div className="text-white font-medium">{car.make} {car.model}</div>
                          <div className="text-gray-500 text-xs">{car.year} · {ENGINE_LABEL[car.engineType]} {car.engineVolume}л</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300 text-sm">{car.ownerName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{car.mileage.toLocaleString()} км</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-400 text-xs">{car.lastService ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-xs font-medium ${soonService ? 'text-orange-400' : 'text-gray-400'}`}>
                        {car.nextService ?? '—'}
                        {soonService && <span className="ml-1">⚠️</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${car.serviceHistory.length > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                        {car.serviceHistory.length} зап.
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal(car)}
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleting(car)}
                          className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-600 py-10">Автомобилей не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {selected && (
        <CarDetail
          car={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setModal(selected); setSelected(null) }}
          onDelete={() => { setDeleting(selected); setSelected(null) }}
        />
      )}

      {modal && (
        <CarModal
          car={modal === 'add' ? undefined : modal}
          clients={clients.map(c => ({ id: c.id, name: c.name }))}
          corporateClients={corporateClients.map(c => ({ id: c.id, companyName: c.companyName }))}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <ActionDialog
          tone="danger" icon={<Archive size={20} />}
          title="Удалить автомобиль?"
          subtitle="Автомобиль будет перенесён в архив"
          points={[
            { kind: 'info', text: 'Пропадёт из списков сайта и Telegram-бота.' },
            { kind: 'keep', text: 'История обслуживания, заказы и траты сохранятся и останутся в отчётах.' },
            { kind: 'keep', text: 'Госномер останется занятым. Вернуть автомобиль можно во вкладке «Архив».' },
          ]}
          confirmLabel="Удалить в архив"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        >
          <CarSummary plate={deleting.licensePlate} label={`${deleting.make} ${deleting.model} · ${deleting.year}`}
            lines={[`${deleting.serviceHistory.length} записей в техкнижке`]} />
        </ActionDialog>
      )}

      {restoring && (
        <ActionDialog
          tone="success" icon={<ArchiveRestore size={20} />}
          title="Восстановить автомобиль?"
          subtitle="Вернуть из архива в автопарк"
          points={[
            { kind: 'keep', text: 'Автомобиль снова появится в списках и в Telegram-боте.' },
            { kind: 'keep', text: 'Вся история обслуживания и заказы на месте.' },
          ]}
          confirmLabel="Восстановить"
          onConfirm={async () => { await restore(restoring.id); setRestoring(null) }}
          onCancel={() => setRestoring(null)}
        >
          <CarSummary plate={restoring.licensePlate} label={`${restoring.make} ${restoring.model} · ${restoring.year}`}
            lines={[restoring.ownerName ? `Владелец: ${restoring.ownerName}` : '', `${restoring.serviceHistory.length} записей в техкнижке`]} />
        </ActionDialog>
      )}

      {plateConflict && (
        <ActionDialog
          tone="success" icon={<ArchiveRestore size={20} />}
          title="Этот госномер уже в архиве"
          subtitle="Добавить ещё один автомобиль с таким номером нельзя"
          points={[
            { kind: 'info', text: 'Автомобиль с этим номером уже был в базе и был удалён в архив.' },
            { kind: 'keep', text: 'Восстановите его — вместе со всей историей обслуживания и заказами.' },
          ]}
          confirmLabel="Восстановить из архива"
          onConfirm={async () => { await restore(plateConflict.carId); setPlateConflict(null); setModal(null) }}
          onCancel={() => setPlateConflict(null)}
        >
          <CarSummary plate={plateConflict.plate} label={plateConflict.label || 'Автомобиль из архива'} />
        </ActionDialog>
      )}
    </div>
  )
}
