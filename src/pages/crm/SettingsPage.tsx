import { useState, useEffect, useRef } from 'react'
import type { ReactNode, DragEvent } from 'react'
import { Save, Building2, Clock, Phone, Bell, LayoutGrid, Eye, Trash2, Plus, GripVertical, X, Upload, Pencil, ImageIcon, Car, ChevronDown, ChevronLeft } from 'lucide-react'
import { api } from '../../api'
import { BrandLogo, brandLogoPath, CAR_BRANDS, type CarBrand } from '../../components/CarFormModal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Caption } from '../../components/ui'

interface WhyBlock { id: string; title: string; desc: string; imageUrl: string }
interface CarModel { id: number; brand_id: number; name: string; image_url: string | null }
interface SocialLink { id: string; name: string; url: string; iconUrl: string }

const DEFAULT_WHY: WhyBlock[] = [
  { id: '1', title: 'Качественные материалы', desc: 'Только оригинальные масла и фильтры ведущих брендов', imageUrl: '' },
  { id: '2', title: 'Опытные мастера', desc: 'Команда профессионалов с опытом более 10 лет', imageUrl: '' },
  { id: '3', title: 'Честные цены', desc: 'Прозрачное ценообразование без скрытых доплат', imageUrl: '' },
  { id: '4', title: 'Гарантия на работы', desc: 'Предоставляем гарантию на все выполненные работы', imageUrl: '' },
  { id: '5', title: 'Работаем по записи', desc: 'Без очередей. Ваше время — ценность для нас', imageUrl: '' },
  { id: '6', title: 'Современное оборудование', desc: 'Профессиональный инструмент и оборудование', imageUrl: '' },
]

const Input = ({ label, value, onChange, placeholder, type = 'text', className = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}) => (
  // flex-1 + min-w-0: so two Inputs sharing a row (e.g. "Открытие — Закрытие") split it evenly
  // instead of each shrinking to the browser's default input width and leaving the row lopsided.
  <div className={`flex-1 min-w-0 ${className}`}>
    <label className="block text-xs text-gray-400 mb-1.5 font-medium">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="input-field" />
  </div>
)

function Section({ icon, title, subtitle, actions, children }: {
  icon: ReactNode; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card mb-4 overflow-hidden">
      <div
        className={`w-full text-left px-5 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors ${open ? 'rounded-t-xl' : 'rounded-xl'}`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 flex-1 min-w-[140px]">
            <span className="text-orange-500 flex-shrink-0">{icon}</span>
            <h3 className="font-semibold text-white">{title}</h3>
            {subtitle && <span className="text-xs text-gray-600 hidden sm:inline">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            <ChevronDown size={16} className={`text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>
      {open && (
        <div className="px-5 pb-5 pt-4 border-t border-[#2a2a2a]">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Block edit modal ──────────────────────────────────────────────────────────
function BlockModal({ block, onSave, onClose }: {
  block: WhyBlock
  onSave: (b: WhyBlock) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<WhyBlock>(block)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const isNew = block.id === '__new__'

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await api.uploadFile(file)
      setForm(f => ({ ...f, imageUrl: url }))
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{isNew ? 'Новый блок' : 'Редактировать блок'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Заголовок</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="Качественные материалы"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Описание</label>
            <textarea
              value={form.desc}
              onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
              className="input-field resize-none"
              rows={3}
              placeholder="Краткое описание преимущества..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Изображение</label>
            {form.imageUrl && (
              <div className="relative mb-2 group">
                <img src={form.imageUrl} alt="" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Upload size={13} />
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <input
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                className="input-field flex-1 text-xs"
                placeholder="или вставьте URL"
              />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-outline text-sm px-4 py-2">Отмена</button>
          <button
            onClick={() => { onSave(form); onClose() }}
            disabled={!form.title.trim()}
            className="btn-orange text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Preview modal ─────────────────────────────────────────────────────────────
function PreviewModal({ blocks, onClose }: { blocks: WhyBlock[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <span className="text-white font-semibold text-sm">Предпросмотр — Главная страница</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">ПОЧЕМУ ВЫБИРАЮТ GARAGE 56</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {blocks.map(b => (
              <div key={b.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 flex gap-4">
                {b.imageUrl ? (
                  <img src={b.imageUrl} alt={b.title} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={22} className="text-orange-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-white mb-1 text-sm">{b.title || 'Заголовок'}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{b.desc || 'Описание'}</p>
                </div>
              </div>
            ))}
          </div>
          {blocks.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">Нет блоков для отображения</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Brand edit modal ──────────────────────────────────────────────────────────
function BrandEditModal({ brand, onSave, onClose }: {
  brand: CarBrand
  onSave: (name: string, imageUrl: string | null) => Promise<void>
  onClose: () => void
}) {
  const isNew = brand.id === -1
  const [name, setName] = useState(brand.name)
  const [imageUrl, setImageUrl] = useState<string | null>(brand.image_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Live preview: use uploaded image, then SVG fallback, then abbr
  const previewSrc = imageUrl || (name ? brandLogoPath(name) : null)
  const abbr = name.split(/[\s-]/).map(w => w[0] ?? '').join('').slice(0, 3).toUpperCase()
  const [previewError, setPreviewError] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await api.uploadFile(file)
      setImageUrl(url)
      setPreviewError(false)
    } catch (err) { console.error(err) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try { await onSave(name.trim(), imageUrl) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <h3 className="text-white font-semibold">{isNew ? 'Добавить марку' : 'Редактировать марку'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-2 shadow-lg">
              {previewSrc && !previewError ? (
                <img
                  src={previewSrc}
                  alt={name}
                  className="w-full h-full object-contain"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <span className="text-xl font-bold text-gray-400">{abbr || '?'}</span>
              )}
            </div>
            <span className="text-white text-sm font-medium">{name || 'Название марки'}</span>
            <span className="text-xs text-gray-600">Предпросмотр</span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Название <span className="text-orange-500">*</span></label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setPreviewError(false) }}
              className="input-field"
              placeholder="Toyota"
              autoFocus={isNew}
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Логотип (необязательно)</label>
            {imageUrl && (
              <div className="relative mb-2 group w-full h-20 bg-white rounded-lg overflow-hidden flex items-center justify-center p-2">
                <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                ><X size={11} /></button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Upload size={13} /> {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <input
                value={imageUrl ?? ''}
                onChange={e => { setImageUrl(e.target.value || null); setPreviewError(false) }}
                className="input-field flex-1 text-xs"
                placeholder="или вставьте URL"
              />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-outline flex-1 text-sm py-2.5">Отмена</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="btn-orange flex-1 text-sm py-2.5 disabled:opacity-40"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Model edit modal ──────────────────────────────────────────────────────────
function ModelEditModal({ model, onSave, onClose }: {
  model: CarModel
  onSave: (name: string, imageUrl: string | null) => Promise<void>
  onClose: () => void
}) {
  const isNew = model.id === -1
  const [name, setName] = useState(model.name)
  const [imageUrl, setImageUrl] = useState<string | null>(model.image_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await api.uploadFile(file)
      setImageUrl(url)
    } catch (err) { console.error(err) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try { await onSave(name.trim(), imageUrl) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#2a2a2a]">
          <h3 className="text-white font-semibold">{isNew ? 'Добавить модель' : 'Редактировать модель'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-20 h-20 bg-[#111] border border-[#2a2a2a] rounded-2xl flex items-center justify-center overflow-hidden">
              {imageUrl
                ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                : <Car size={28} className="text-gray-600" />}
            </div>
            <span className="text-white text-sm font-medium">{name || 'Название модели'}</span>
            <span className="text-xs text-gray-600">Предпросмотр</span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Название <span className="text-orange-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Название модели" autoFocus={isNew} />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Изображение (необязательно)</label>
            {imageUrl && (
              <div className="relative mb-2 group w-full h-20 bg-[#111] rounded-lg overflow-hidden flex items-center justify-center">
                <img src={imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                ><X size={11} /></button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Upload size={13} /> {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <input
                value={imageUrl ?? ''}
                onChange={e => setImageUrl(e.target.value || null)}
                className="input-field flex-1 text-xs"
                placeholder="или вставьте URL"
              />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-outline flex-1 text-sm py-2.5">Отмена</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="btn-orange flex-1 text-sm py-2.5 disabled:opacity-40"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Social link modal ─────────────────────────────────────────────────────────
function SocialLinkModal({ link, onSave, onClose }: {
  link: SocialLink
  onSave: (l: SocialLink) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<SocialLink>(link)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const isNew = link.id === '__new__'

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await api.uploadFile(file)
      setForm(f => ({ ...f, iconUrl: url }))
    } catch (err) { console.error(err) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{isNew ? 'Новый контакт' : 'Редактировать контакт'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Название *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-field" placeholder="WhatsApp, Instagram, 2GIS..." autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Ссылка / номер *</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              className="input-field" placeholder="https://wa.me/77011234567" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Иконка</label>
            {form.iconUrl && (
              <div className="relative mb-2 group w-16 h-16 bg-[#111] rounded-lg overflow-hidden flex items-center justify-center border border-[#2a2a2a]">
                <img src={form.iconUrl} alt="" className="w-10 h-10 object-contain" />
                <button onClick={() => setForm(f => ({ ...f, iconUrl: '' }))}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} className="text-white" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
                <Upload size={13} /> {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <input value={form.iconUrl} onChange={e => setForm(f => ({ ...f, iconUrl: e.target.value }))}
                className="input-field flex-1 text-xs" placeholder="или вставьте URL иконки" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn-outline text-sm px-4 py-2">Отмена</button>
          <button onClick={() => { onSave(form); onClose() }} disabled={!form.name.trim() || !form.url.trim()}
            className="btn-orange text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [owners, setOwners] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [editingLink, setEditingLink] = useState<SocialLink | null>(null)
  const [weekdayOpen, setWeekdayOpen] = useState('09:00')
  const [weekdayClose, setWeekdayClose] = useState('19:00')
  const [satOpen, setSatOpen] = useState('09:00')
  const [satClose, setSatClose] = useState('18:00')
  const [sunOpen, setSunOpen] = useState('10:00')
  const [sunClose, setSunClose] = useState('17:00')
  const [sunClosed, setSunClosed] = useState(false)
  const [slotDuration, setSlotDuration] = useState('60')
  const [maxSlots, setMaxSlots] = useState('8')
  const [bookingDaysAhead, setBookingDaysAhead] = useState('14')
  const [regularThreshold, setRegularThreshold] = useState('3')

  // Car brands
  const [brands, setBrands] = useState<CarBrand[]>([])
  const [confirmDelete, setConfirmDelete] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [editingBrand, setEditingBrand] = useState<CarBrand | null>(null)
  const [showBrandPreview, setShowBrandPreview] = useState<CarBrand | null>(null)
  const [importingZip, setImportingZip] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  // Car models
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null)
  const [models, setModels] = useState<CarModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [editingModel, setEditingModel] = useState<CarModel | null>(null)

  // Why blocks
  const [whyBlocks, setWhyBlocks] = useState<WhyBlock[]>([])
  const [editingBlock, setEditingBlock] = useState<WhyBlock | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    api.getCarBrands().then(d => setBrands(Array.isArray(d) ? d : [])).catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedBrandId) { setModels([]); return }
    setModelsLoading(true)
    api.getCarModels(selectedBrandId)
      .then(d => setModels(d.map(m => ({ id: m.id, brand_id: selectedBrandId, name: m.name, image_url: m.imageUrl }))))
      .catch(console.error)
      .finally(() => setModelsLoading(false))
  }, [selectedBrandId])

  useEffect(() => {
    api.getSettings().then(s => {
      if (s.name) setName(s.name)
      if (s.owners) setOwners(s.owners)
      if (s.address) setAddress(s.address)
      if (s.phone) setPhone(s.phone)
      if (s.email) setEmail(s.email)
      if (s.weekday_open) setWeekdayOpen(s.weekday_open)
      if (s.weekday_close) setWeekdayClose(s.weekday_close)
      if (s.sat_open) setSatOpen(s.sat_open)
      if (s.sat_close) setSatClose(s.sat_close)
      if (s.sun_open) setSunOpen(s.sun_open)
      if (s.sun_close) setSunClose(s.sun_close)
      if (s.sun_closed) setSunClosed(s.sun_closed === 'true')
      if (s.slot_duration) setSlotDuration(s.slot_duration)
      if (s.max_slots) setMaxSlots(s.max_slots)
      if (s.booking_days_ahead) setBookingDaysAhead(s.booking_days_ahead)
      if (s.regular_client_threshold) setRegularThreshold(s.regular_client_threshold)
      if (s.why_blocks) {
        try { setWhyBlocks(JSON.parse(s.why_blocks)) } catch {}
      } else {
        setWhyBlocks(DEFAULT_WHY)
      }
      if (s.social_links) {
        try { setSocialLinks(JSON.parse(s.social_links)) } catch {}
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    try {
      await api.updateSettings({
        name, owners, address, phone, email,
        weekday_open: weekdayOpen, weekday_close: weekdayClose,
        sat_open: satOpen, sat_close: satClose,
        sun_open: sunOpen, sun_close: sunClose,
        sun_closed: String(sunClosed),
        slot_duration: slotDuration,
        max_slots: maxSlots,
        booking_days_ahead: bookingDaysAhead,
        regular_client_threshold: regularThreshold,
        why_blocks: JSON.stringify(whyBlocks),
        social_links: JSON.stringify(socialLinks),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1000)
    } catch (e) {
      console.error(e)
    }
  }

  // Drag-to-reorder
  const handleDragStart = (e: DragEvent<HTMLDivElement>, i: number) => {
    setDragIndex(i)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnter = (e: DragEvent<HTMLDivElement>, i: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === i) return
    const next = [...whyBlocks]
    const [item] = next.splice(dragIndex, 1)
    next.splice(i, 0, item)
    setWhyBlocks(next)
    setDragIndex(i)
  }
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDragEnd = () => {
    setDragIndex(null)
    api.updateSettings({ why_blocks: JSON.stringify(whyBlocks) }).catch(console.error)
  }

  const addBlock = () => setEditingBlock({ id: '__new__', title: '', desc: '', imageUrl: '' })
  const saveBlock = (b: WhyBlock) => {
    const newBlocks = b.id === '__new__'
      ? [...whyBlocks, { ...b, id: String(Date.now()) }]
      : whyBlocks.map(x => x.id === b.id ? b : x)
    setWhyBlocks(newBlocks)
    api.updateSettings({ why_blocks: JSON.stringify(newBlocks) }).catch(console.error)
  }
  const deleteBlock = (id: string) => {
    const newBlocks = whyBlocks.filter(x => x.id !== id)
    setWhyBlocks(newBlocks)
    api.updateSettings({ why_blocks: JSON.stringify(newBlocks) }).catch(console.error)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Загрузка...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Настройки</h1>
        <button onClick={handleSave}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all ${saved ? 'bg-green-500 text-white' : 'btn-orange'}`}>
          <Save size={15} />
          {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>

      {/* Two independent columns, so paired sections are chosen to keep both columns roughly the
          same height (Контакты is short, so it is paired with the taller Онлайн-запись, etc.) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <Section icon={<Building2 size={18} />} title="Информация о сервисе">
            <div className="space-y-3">
              <Input label="Название" value={name} onChange={setName} placeholder="Garage 56" />
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Владелец(ы)</label>
                <input
                  type="text"
                  value={owners}
                  onChange={e => setOwners(e.target.value)}
                  placeholder="Владимир Гаражников, Алексей Капучкин"
                  className="input-field"
                />
                <div className="text-xs text-gray-600 mt-1">Несколько владельцев — через запятую</div>
              </div>
              <Input label="Адрес" value={address} onChange={setAddress} placeholder="г. Алматы, ул. Примерная, 56" />
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="info@garage56.kz" />
            </div>
          </Section>

          <Section icon={<Clock size={18} />} title="Часы работы">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-2 font-medium">Понедельник — Пятница</div>
                <div className="flex items-end gap-3">
                  <Input type="time" label="Открытие" value={weekdayOpen} onChange={setWeekdayOpen} placeholder="09:00" />
                  <span className="text-gray-500 pb-2.5">—</span>
                  <Input type="time" label="Закрытие" value={weekdayClose} onChange={setWeekdayClose} placeholder="19:00" />
                </div>
              </div>

              {/* Weekend, set apart from weekdays so it doesn't read as just another workday */}
              <div className="pt-4 border-t border-[#2a2a2a] space-y-3">
                <Caption>Выходные дни</Caption>
                <div>
                  <div className="text-xs text-gray-400 mb-2 font-medium">Суббота</div>
                  <div className="flex items-end gap-3">
                    <Input type="time" label="Открытие" value={satOpen} onChange={setSatOpen} placeholder="09:00" />
                    <span className="text-gray-500 pb-2.5">—</span>
                    <Input type="time" label="Закрытие" value={satClose} onChange={setSatClose} placeholder="18:00" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-400 font-medium">Воскресенье</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={sunClosed} onChange={e => setSunClosed(e.target.checked)}
                        className="accent-orange-500" />
                      <span className="text-xs text-gray-500">Выходной</span>
                    </label>
                  </div>
                  {!sunClosed && (
                    <div className="flex items-end gap-3">
                      <Input type="time" label="Открытие" value={sunOpen} onChange={setSunOpen} placeholder="10:00" />
                      <span className="text-gray-500 pb-2.5">—</span>
                      <Input type="time" label="Закрытие" value={sunClose} onChange={setSunClose} placeholder="17:00" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div>
          <Section icon={<Phone size={18} />} title="Контакты">
            <div className="space-y-3">
              <Input label="Основной телефон" value={phone} onChange={setPhone} placeholder="+7 (701) 123-45-67" />
              <div className="border-t border-[#2a2a2a] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400 font-medium">Соц. сети и дополнительные контакты</label>
                  <button
                    onClick={() => setEditingLink({ id: '__new__', name: '', url: '', iconUrl: '' })}
                    className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors">
                    <Plus size={13} /> Добавить
                  </button>
                </div>
                <div className="space-y-2">
                  {socialLinks.map(link => (
                    <div key={link.id} className="flex items-center gap-3 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                      <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#2a2a2a]">
                        {link.iconUrl
                          ? <img src={link.iconUrl} alt={link.name} className="w-6 h-6 object-contain" />
                          : <span className="text-orange-400 text-xs font-bold">{link.name[0]?.toUpperCase()}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium truncate">{link.name}</div>
                        <div className="text-gray-500 text-xs truncate">{link.url}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingLink(link)} className="text-gray-500 hover:text-white p-1 rounded transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => {
                          const updated = socialLinks.filter(l => l.id !== link.id)
                          setSocialLinks(updated)
                          api.updateSettings({ social_links: JSON.stringify(updated) }).catch(console.error)
                        }} className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                  {socialLinks.length === 0 && (
                    <div className="text-center py-3 text-gray-600 text-xs">Добавьте WhatsApp, Instagram, 2GIS и т.д.</div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section icon={<Bell size={18} />} title="Онлайн-запись">
            <div className="space-y-3">
              <Input label="Длительность слота (минут)" value={slotDuration} onChange={setSlotDuration} placeholder="60" type="number" />
              <Input label="Максимум записей в день" value={maxSlots} onChange={setMaxSlots} placeholder="8" type="number" />
              <Input label="Запись доступна за (дней)" value={bookingDaysAhead} onChange={setBookingDaysAhead} placeholder="14" type="number" />
              <Input label="Постоянный клиент — от (визитов)" value={regularThreshold} onChange={setRegularThreshold} placeholder="3" type="number" />
              <div className="bg-[#111] border border-[#2a2a2a] rounded-lg px-4 py-3 text-xs text-gray-500">
                <span className="text-gray-400 font-medium">Длительность слота</span> — шаг временной сетки при онлайн-записи.
                При 60 мин клиент выбирает из 09:00, 10:00, 11:00…
                При 30 мин — из 09:00, 09:30, 10:00…
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Car brands CMS */}
      <Section
        icon={<Car size={18} />}
        title="Марки автомобилей"
        subtitle="— доступны в форме записи"
        actions={!selectedBrandId ? (
          <>
            <button
              onClick={() => zipInputRef.current?.click()}
              disabled={importingZip}
              className="flex items-center gap-1.5 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              title="Загрузить .zip архив с логотипами и моделями"
            >
              <Upload size={13} /> {importingZip ? 'Импорт...' : 'Загрузить .zip'}
            </button>
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setImportingZip(true)
                setImportResult(null)
                try {
                  const res = await api.importCarBrandsZip(file)
                  const fresh = await api.getCarBrands()
                  setBrands(Array.isArray(fresh) ? fresh : [])
                  setImportResult(`Импортировано: ${res.imported} марок${res.importedModels ? `, ${res.importedModels} моделей` : ''}`)
                  setTimeout(() => setImportResult(null), 4000)
                } catch (err) {
                  setImportResult('Ошибка импорта')
                  setTimeout(() => setImportResult(null), 4000)
                } finally {
                  setImportingZip(false)
                  if (zipInputRef.current) zipInputRef.current.value = ''
                }
              }}
            />
            <button
              onClick={() => setEditingBrand({ id: -1, name: '', image_url: null })}
              className="flex items-center gap-1.5 text-xs btn-orange px-3 py-2"
            >
              <Plus size={13} /> Добавить марку
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditingModel({ id: -1, brand_id: selectedBrandId, name: '', image_url: null })}
            className="flex items-center gap-1.5 text-xs btn-orange px-3 py-2"
          >
            <Plus size={13} /> Добавить модель
          </button>
        )}
      >
        {!selectedBrandId ? (
          <>
            {importResult && (
              <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${importResult.startsWith('Ошибка') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                {importResult}
              </div>
            )}
            {/* Same tile recipe as the customer-facing brand picker (CarFormModal), just denser and
                with edit/delete on hover — 20 brands as 56px logo tiles was taking up the whole page */}
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
              {brands.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBrandId(b.id)}
                  className="bg-[#111] border border-[#2a2a2a] rounded-xl p-2.5 flex flex-col items-center gap-1.5 group relative cursor-pointer hover:border-orange-500/40 transition-colors"
                >
                  <BrandLogo brand={b.name} imageUrl={b.image_url} size="md" />
                  <span className="text-xs text-gray-300 font-medium text-center leading-tight">{b.name}</span>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingBrand(b) }}
                      className="bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white p-1 rounded transition-colors"
                    ><Pencil size={11} /></button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete({
                        message: `Удалить марку «${b.name}»?`,
                        onConfirm: async () => {
                          await api.deleteCarBrand(b.id)
                          setBrands(prev => prev.filter(x => x.id !== b.id))
                        }
                      }) }}
                      className="bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
                    ><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Brand header */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#2a2a2a]">
              <button
                onClick={() => setSelectedBrandId(null)}
                className="text-gray-500 hover:text-white p-1 rounded transition-colors"
              ><ChevronLeft size={16} /></button>
              <BrandLogo brand={brands.find(b => b.id === selectedBrandId)?.name || ''} imageUrl={brands.find(b => b.id === selectedBrandId)?.image_url} size="sm" />
              <span className="text-white font-medium text-sm">{brands.find(b => b.id === selectedBrandId)?.name}</span>
              <span className="text-gray-600 text-xs ml-auto">{models.length} мод.</span>
            </div>

            {modelsLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Загрузка...</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {models.map(m => (
                  <div key={m.id} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-2.5 flex flex-col items-center gap-1.5 group relative">
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                      {m.image_url
                        ? <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                        : <Car size={22} className="text-gray-600" />}
                    </div>
                    <span className="text-xs text-gray-300 font-medium text-center leading-tight">{m.name}</span>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingModel(m)}
                        className="bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white p-1 rounded transition-colors"
                      ><Pencil size={11} /></button>
                      <button
                        onClick={() => setConfirmDelete({
                          message: `Удалить модель «${m.name}»?`,
                          onConfirm: async () => {
                            await api.deleteCarModel(m.id)
                            setModels(prev => prev.filter(x => x.id !== m.id))
                          }
                        })}
                        className="bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
                      ><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {/* Brand edit modal */}
      {editingBrand && (
        <BrandEditModal
          brand={editingBrand}
          onSave={async (name, imageUrl) => {
            if (editingBrand.id === -1) {
              const { id } = await api.createCarBrand({ name, imageUrl: imageUrl || undefined })
              setBrands(prev => [...prev, { id, name, image_url: imageUrl || null }])
            } else {
              await api.updateCarBrand(editingBrand.id, { name, imageUrl })
              setBrands(prev => prev.map(b => b.id === editingBrand.id ? { ...b, name, image_url: imageUrl ?? null } : b))
            }
            setEditingBrand(null)
          }}
          onClose={() => setEditingBrand(null)}
        />
      )}

      {/* Model edit modal */}
      {editingModel && (
        <ModelEditModal
          model={editingModel}
          onSave={async (name, imageUrl) => {
            if (editingModel.id === -1) {
              const { id } = await api.createCarModel({ brandId: editingModel.brand_id, name, imageUrl })
              setModels(prev => [...prev, { id, brand_id: editingModel.brand_id, name, image_url: imageUrl }])
            } else {
              await api.updateCarModel(editingModel.id, { name, imageUrl })
              setModels(prev => prev.map(m => m.id === editingModel.id ? { ...m, name, image_url: imageUrl } : m))
            }
            setEditingModel(null)
          }}
          onClose={() => setEditingModel(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.message}
          onConfirm={confirmDelete.onConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* WHY blocks CMS */}
      <Section
        icon={<LayoutGrid size={18} />}
        title="Блоки «Почему выбирают нас»"
        subtitle="— перетащите для сортировки"
        actions={<>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-1.5 text-xs bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-lg transition-colors"
          >
            <Eye size={13} /> Предпросмотр
          </button>
          <button onClick={addBlock} className="flex items-center gap-1.5 text-xs btn-orange px-3 py-2">
            <Plus size={13} /> Добавить блок
          </button>
        </>}
      >

        <div className="space-y-2">
          {whyBlocks.map((b, i) => (
            <div
              key={b.id}
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragEnter={e => handleDragEnter(e, i)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 bg-[#111] border rounded-lg p-3 transition-all select-none ${
                dragIndex === i
                  ? 'border-orange-500/50 opacity-50 scale-[0.99]'
                  : 'border-[#2a2a2a] hover:border-[#3a3a3a] cursor-grab active:cursor-grabbing'
              }`}
            >
              <GripVertical size={16} className="text-gray-600 flex-shrink-0" />
              {b.imageUrl ? (
                <img src={b.imageUrl} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={15} className="text-gray-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{b.title || <span className="text-gray-600 italic">Без заголовка</span>}</div>
                <div className="text-gray-500 text-xs truncate mt-0.5">{b.desc}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditingBlock(b)}
                  className="text-gray-500 hover:text-white p-1.5 rounded transition-colors"
                  title="Редактировать"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteBlock(b.id)}
                  className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {whyBlocks.length === 0 && (
            <div className="text-center py-10 text-gray-600 text-sm">
              Нет блоков. Нажмите «Добавить блок», чтобы создать первый.
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-600">
          Изменения применятся после нажатия кнопки <span className="text-gray-500 font-medium">Сохранить</span> вверху страницы.
        </div>
      </Section>

      {/* Modals */}
      {editingBlock && (
        <BlockModal
          block={editingBlock}
          onSave={saveBlock}
          onClose={() => setEditingBlock(null)}
        />
      )}
      {showPreview && (
        <PreviewModal
          blocks={whyBlocks}
          onClose={() => setShowPreview(false)}
        />
      )}
      {editingLink && (
        <SocialLinkModal
          link={editingLink}
          onSave={saved => {
            const updated = saved.id === '__new__'
              ? [...socialLinks, { ...saved, id: String(Date.now()) }]
              : socialLinks.map(l => l.id === saved.id ? saved : l)
            setSocialLinks(updated)
            api.updateSettings({ social_links: JSON.stringify(updated) }).catch(console.error)
          }}
          onClose={() => setEditingLink(null)}
        />
      )}
    </div>
  )
}
