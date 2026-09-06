import { useState, useEffect } from 'react'
import { X, Wrench, Car, ChevronDown } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

export interface CarData {
  make: string
  model: string
  year: string
  engineType: string
  engineVolume: string
  mileage: string
  licensePlate: string
  makeImageUrl?: string | null
  makeId?: number | null
}

export interface CarBrand { id: number; name: string; image_url: string | null }
interface CarModel { id: number; name: string; imageUrl: string | null }

const ENGINE_TYPES = ['Бензин', 'Электро', 'Газ', 'Дизель', 'Гибрид']

// Fallback list if API is unreachable
export const CAR_BRANDS = [
  'BMW', 'BYD', 'Changan', 'Chery', 'Chevrolet',
  'Haval', 'Hyundai', 'Kia', 'Lada', 'Lexus',
  'Li Auto', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan',
  'Skoda', 'Tank', 'Tesla', 'Toyota', 'Volvo',
]

export function brandLogoPath(name: string) {
  return `/Cars_Marks_SVG/${encodeURIComponent(name)}/Mark/Logo.svg`
}

// ─── Brand logo with fallback ──────────────────────────────────────────────────
export function BrandLogo({ brand, imageUrl, size = 'md' }: {
  brand: string
  imageUrl?: string | null
  size?: 'sm' | 'md'
}) {
  const [src, setSrc] = useState(imageUrl || brandLogoPath(brand))
  const [failed, setFailed] = useState(false)
  const box = size === 'sm' ? 'w-5 h-5 rounded p-0.5' : 'w-14 h-14 rounded-xl p-2'
  const abbr = brand.split(/[\s-]/).map(w => w[0] ?? '').join('').slice(0, 3).toUpperCase()

  // If imageUrl changes (e.g. after upload), reset state
  useEffect(() => {
    setSrc(imageUrl || brandLogoPath(brand))
    setFailed(false)
  }, [brand, imageUrl])

  return (
    <div className={`${box} bg-white flex items-center justify-center flex-shrink-0`}>
      {failed ? (
        <span className="text-[8px] font-bold text-gray-700 leading-none text-center">{abbr}</span>
      ) : (
        <img
          src={src}
          alt={brand}
          className="w-full h-full object-contain"
          onError={() => {
            // If DB image failed, try SVG fallback; if SVG also fails, show abbr
            if (src !== brandLogoPath(brand)) {
              setSrc(brandLogoPath(brand))
            } else {
              setFailed(true)
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Brand picker modal ────────────────────────────────────────────────────────
export function BrandPickerModal({ onSelect, onClose, zIndex = 'z-[70]' }: {
  onSelect: (brand: string, imageUrl?: string | null, brandId?: number) => void
  onClose: () => void
  zIndex?: string
}) {
  const [search, setSearch] = useState('')
  const [brands, setBrands] = useState<CarBrand[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/api/car-brands`)
      .then(r => r.json())
      .then((d: CarBrand[]) => setBrands(d))
      .catch(() => setBrands(CAR_BRANDS.map((name, i) => ({ id: i, name, image_url: null }))))
  }, [])

  const filtered = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center ${zIndex} p-4`}
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md sm:max-w-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-white font-semibold">Выберите марку</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-4 pb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск марки..."
            className="input-field text-sm"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 px-4 pb-5 max-h-72 sm:max-h-[70vh] overflow-y-auto">
          {filtered.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => { onSelect(b.name, b.image_url, b.id); onClose() }}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#111] border border-[#2a2a2a] hover:border-orange-500/60 transition-all group"
            >
              <BrandLogo brand={b.name} imageUrl={b.image_url} size="md" />
              <span className="text-xs text-gray-400 group-hover:text-white text-center leading-tight">{b.name}</span>
            </button>
          ))}
          {filtered.length === 0 && brands.length > 0 && (
            <div className="col-span-4 text-center py-6 text-gray-600 text-sm">Не найдено</div>
          )}
          {brands.length === 0 && (
            <div className="col-span-4 text-center py-6 text-gray-500 text-sm">Загрузка...</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Car form modal ────────────────────────────────────────────────────────────
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
      {label} {required && <span className="text-orange-500">*</span>}
    </label>
    {children}
  </div>
)

export function CarFormModal({ initialData, onSave, onClose, zIndex = 'z-[60]' }: {
  initialData?: Partial<CarData & { makeImageUrl?: string | null }>
  onSave: (data: CarData) => void
  onClose: () => void
  zIndex?: string
}) {
  const [showBrandPicker, setShowBrandPicker] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [make, setMake] = useState(initialData?.make ?? '')
  const [makeImageUrl, setMakeImageUrl] = useState<string | null>(initialData?.makeImageUrl ?? null)
  const [makeId, setMakeId] = useState<number | null>(initialData?.makeId ?? null)
  const [availableModels, setAvailableModels] = useState<CarModel[]>([])
  const [model, setModel] = useState(initialData?.model ?? '')
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null)
  const [year, setYear] = useState(initialData?.year ?? '')
  const [engineType, setEngineType] = useState(initialData?.engineType ?? 'Бензин')
  const [engineTypeOpen, setEngineTypeOpen] = useState(false)
  const [engineVolume, setEngineVolume] = useState(initialData?.engineVolume ?? '')
  const [mileage, setMileage] = useState(initialData?.mileage ?? '')
  const [licensePlate, setLicensePlate] = useState(initialData?.licensePlate ?? '')

  useEffect(() => {
    if (!makeId) { setAvailableModels([]); return }
    fetch(`${API_BASE}/api/car-models?brandId=${makeId}`)
      .then(r => r.json())
      .then((d: CarModel[]) => setAvailableModels(Array.isArray(d) ? d : []))
      .catch(() => setAvailableModels([]))
  }, [makeId])

  const canSave = make && model && year && engineVolume && mileage && licensePlate

  const handleSave = () => {
    onSave({ make, model, year, engineType, engineVolume, mileage, licensePlate, makeImageUrl, makeId })
    onClose()
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/80 flex items-center justify-center ${zIndex} p-4`}
        onClick={onClose}
      >
        <div
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
            <h3 className="text-white font-semibold">Данные автомобиля</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
          </div>

          <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
            <Field label="Марка" required>
              <button
                type="button"
                onClick={() => setShowBrandPicker(true)}
                className="input-field w-full flex items-center justify-center gap-2"
              >
                {make ? (
                  <>
                    <BrandLogo brand={make} imageUrl={makeImageUrl} size="sm" />
                    <span className="text-white text-sm">{make}</span>
                  </>
                ) : (
                  <span className="text-gray-600 text-sm">Выберите марку</span>
                )}
              </button>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Модель" required>
                {availableModels.length > 0 ? (
                  <button type="button" onClick={() => setShowModelPicker(true)}
                    className="input-field w-full flex items-center gap-2">
                    {model ? (
                      <>
                        {modelImageUrl
                          ? <img src={modelImageUrl} alt={model} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                          : <Car size={14} className="text-gray-500 flex-shrink-0" />}
                        <span className="text-white text-sm">{model}</span>
                      </>
                    ) : (
                      <span className="text-gray-600 text-sm">Выберите модель</span>
                    )}
                  </button>
                ) : (
                  <input value={model} onChange={e => setModel(e.target.value)}
                    className="input-field text-center text-sm" placeholder="Выберите модель" />
                )}
              </Field>
              <Field label="Тип двигателя" required>
                <div className="relative">
                  <button type="button" onClick={() => setEngineTypeOpen(o => !o)}
                    className="input-field w-full flex items-center justify-between text-sm">
                    <span className="text-white">{engineType}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${engineTypeOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {engineTypeOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden z-10 shadow-xl">
                      {ENGINE_TYPES.map(t => (
                        <button key={t} type="button"
                          onClick={() => { setEngineType(t); setEngineTypeOpen(false) }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            engineType === t ? 'bg-orange-500/20 text-orange-400' : 'text-gray-300 hover:bg-[#222] hover:text-white'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </div>

            <Field label="Год выпуска" required>
              <input type="text" inputMode="numeric" value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input-field text-center text-sm" placeholder="Год выпуска" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Объём (л)" required>
                <input type="number" step="0.1" value={engineVolume} onChange={e => setEngineVolume(e.target.value)}
                  className="input-field text-center text-sm" placeholder="Объём (л)" />
              </Field>
              <Field label="Пробег (км)" required>
                <input type="number" value={mileage} onChange={e => setMileage(e.target.value)}
                  className="input-field text-center text-sm" placeholder="Пробег (км)" />
              </Field>
            </div>

            <Field label="Гос. номер" required>
              <input value={licensePlate} onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                className="input-field text-center text-sm" placeholder="Гос. номер" />
            </Field>
          </div>

          <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-[#2a2a2a]">
            <button onClick={onClose} className="btn-outline flex-1 text-sm py-2.5">Отмена</button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="btn-orange flex-1 text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>

      {showBrandPicker && (
        <BrandPickerModal
          onSelect={(name, imgUrl, brandId) => { setMake(name); setMakeImageUrl(imgUrl ?? null); setMakeId(brandId ?? null); setModel(''); setModelImageUrl(null) }}
          onClose={() => setShowBrandPicker(false)}
          zIndex="z-[80]"
        />
      )}

      {showModelPicker && makeId && (
        <ModelPickerModal
          brandId={makeId}
          onSelect={(name, imgUrl) => { setModel(name); setModelImageUrl(imgUrl ?? null) }}
          onClose={() => setShowModelPicker(false)}
          zIndex="z-[90]"
        />
      )}
    </>
  )
}

// ─── Service picker modal ───────────────────────────────────────────────────────
interface ServiceItem { id: string; name: string; imageUrl: string; price: number; isActive: boolean }

export function ServicePickerModal({ onSelect, onClose, zIndex = 'z-[70]' }: {
  onSelect: (name: string) => void
  onClose: () => void
  zIndex?: string
}) {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/services`)
      .then(r => r.json())
      .then((d: ServiceItem[]) => setServices(Array.isArray(d) ? d.filter(s => s.isActive) : []))
      .catch(() => {})
  }, [])

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center ${zIndex} p-4`}
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-white font-semibold">Выберите услугу</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-4 pb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск услуги..."
            className="input-field text-sm"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2 px-4 pb-5 max-h-72 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSelect(s.name); onClose() }}
              className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-[#2a2a2a] hover:border-orange-500/60 transition-all text-left group"
            >
              {s.imageUrl ? (
                <img src={s.imageUrl} alt={s.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Wrench size={18} className="text-orange-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium group-hover:text-orange-400 transition-colors">{s.name}</div>
                <div className="text-xs text-gray-500">от {s.price.toLocaleString('ru-RU')} ₸</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && services.length > 0 && (
            <div className="text-center py-6 text-gray-600 text-sm">Не найдено</div>
          )}
          {services.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">Загрузка...</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Model picker modal ─────────────────────────────────────────────────────────
export function ModelPickerModal({ brandId, onSelect, onClose, zIndex = 'z-[70]' }: {
  brandId: number
  onSelect: (name: string, imageUrl?: string | null) => void
  onClose: () => void
  zIndex?: string
}) {
  const [models, setModels] = useState<CarModel[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/api/car-models?brandId=${brandId}`)
      .then(r => r.json())
      .then((d: CarModel[]) => setModels(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [brandId])

  const filtered = models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center ${zIndex} p-4`}
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg sm:max-w-4xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-white font-semibold">Выберите модель</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-4 pb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск модели..."
            className="input-field text-sm"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 pb-5 max-h-[60vh] sm:max-h-[75vh] overflow-y-auto">
          {filtered.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onSelect(m.name, m.imageUrl); onClose() }}
              className="flex flex-col rounded-xl bg-[#111] border border-[#2a2a2a] hover:border-orange-500/60 transition-all group overflow-hidden text-left"
            >
              {m.imageUrl ? (
                <img src={m.imageUrl} alt={m.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-[#222] flex items-center justify-center">
                  <Car size={36} className="text-gray-600" />
                </div>
              )}
              <div className="px-3 py-2">
                <span className="text-sm text-white font-medium group-hover:text-orange-400 transition-colors">{m.name}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && models.length > 0 && (
            <div className="col-span-2 text-center py-6 text-gray-600 text-sm">Не найдено</div>
          )}
          {models.length === 0 && (
            <div className="col-span-2 text-center py-6 text-gray-500 text-sm">Загрузка...</div>
          )}
        </div>
      </div>
    </div>
  )
}
