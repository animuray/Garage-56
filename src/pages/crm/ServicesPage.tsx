import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Clock, ToggleLeft, ToggleRight, Upload, Link } from 'lucide-react'
import { api } from '../../api'

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

interface Service {
  id: string
  name: string
  description: string
  price: number
  duration: number
  isActive: boolean
  sortOrder: number
  imageUrl: string
}

const empty = (): Omit<Service, 'id'> => ({
  name: '', description: '', price: 0, duration: 30, isActive: true, sortOrder: 0, imageUrl: '',
})

const fmt = (n: number) => n.toLocaleString('ru-RU')

interface ModalProps {
  initial: Omit<Service, 'id'>
  onSave: (data: Omit<Service, 'id'>) => void
  onClose: () => void
}

function ServiceModal({ initial, onSave, onClose }: ModalProps) {
  const [form, setForm] = useState(initial)
  const [imgTab, setImgTab] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof form) => (v: string | number | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const { url } = await res.json()
      setForm(f => ({ ...f, imageUrl: url }))
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg p-6">
        <h2 className="text-white font-semibold text-lg mb-5">{initial.name ? 'Редактировать услугу' : 'Новая услуга'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Название <span className="text-orange-500">*</span></label>
            <input value={form.name} onChange={e => set('name')(e.target.value)} className="input-field" placeholder="Замена масла двигателя" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Описание</label>
            <textarea value={form.description} onChange={e => set('description')(e.target.value)}
              className="input-field resize-none" rows={3} placeholder="Краткое описание услуги..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Цена (₸) <span className="text-orange-500">*</span></label>
              <input type="number" value={form.price} onChange={e => set('price')(Number(e.target.value))}
                onFocus={e => e.target.select()} className="input-field" placeholder="3500" min={0} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Длительность (мин)</label>
              <input type="number" value={form.duration} onChange={e => set('duration')(Number(e.target.value))}
                className="input-field" placeholder="30" min={5} step={5} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Порядок сортировки</label>
            <input type="number" value={form.sortOrder} onChange={e => set('sortOrder')(Number(e.target.value))}
              onFocus={e => e.target.select()} className="input-field" placeholder="0" min={0} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">Фото</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setImgTab('url')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${imgTab === 'url' ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-[#2a2a2a] text-gray-400 hover:border-gray-500'}`}>
                <Link size={12} /> URL
              </button>
              <button type="button" onClick={() => setImgTab('upload')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${imgTab === 'upload' ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-[#2a2a2a] text-gray-400 hover:border-gray-500'}`}>
                <Upload size={12} /> Загрузить файл
              </button>
            </div>
            {imgTab === 'url' ? (
              <input value={form.imageUrl} onChange={e => set('imageUrl')(e.target.value)}
                className="input-field" placeholder="https://example.com/image.jpg" />
            ) : (
              <div
                className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-4 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
              >
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
                {uploading
                  ? <p className="text-gray-400 text-xs">Загрузка...</p>
                  : <><Upload size={20} className="text-gray-500 mx-auto mb-1" /><p className="text-gray-400 text-xs">Нажмите или перетащите файл</p><p className="text-gray-600 text-xs mt-0.5">JPG, PNG, WEBP — до 5 МБ</p></>
                }
              </div>
            )}
            {form.imageUrl && (
              <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-full object-cover rounded-lg border border-[#2a2a2a]"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => set('isActive')(e.target.checked)} className="accent-orange-500" />
            <span className="text-sm text-gray-300">Активна (отображается на сайте)</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
          <button onClick={() => form.name && onSave(form)} disabled={!form.name}
            className="btn-orange flex-1 disabled:opacity-40">Сохранить</button>
        </div>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; service: Service | null }>({ open: false, service: null })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.getServices().then(d => setServices(d as Service[])).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: Omit<Service, 'id'>) => {
    if (modal.service) {
      await api.updateService(Number(modal.service.id), data)
    } else {
      await api.createService(data)
    }
    setModal({ open: false, service: null })
    load()
  }

  const handleDelete = async (id: string) => {
    await api.deleteService(Number(id))
    setDeleteId(null)
    load()
  }

  const toggleActive = async (s: Service) => {
    await api.updateService(Number(s.id), { ...s, isActive: !s.isActive })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Услуги</h1>
          <p className="text-gray-500 text-sm">Управление услугами сервиса</p>
        </div>
        <button onClick={() => setModal({ open: true, service: null })} className="btn-orange flex items-center gap-1.5 text-sm px-3 py-2 sm:px-4">
          <Plus size={15} />
          <span className="hidden sm:inline">Добавить услугу</span>
          <span className="sm:hidden">Добавить</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-500">Загрузка...</div>
      ) : services.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">Нет услуг. Добавьте первую.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {services.map(s => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {s.imageUrl && (
                    <img src={s.imageUrl} alt={s.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-white font-semibold text-sm">{s.name}</div>
                        {s.description && <div className="text-gray-500 text-xs mt-0.5 line-clamp-2">{s.description}</div>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-orange-400 text-sm font-medium">от {fmt(s.price)} ₸</span>
                          <span className="text-gray-500 text-xs flex items-center gap-1"><Clock size={11} /> {s.duration} мин</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => toggleActive(s)} title="Вкл/выкл">
                          {s.isActive
                            ? <ToggleRight size={22} className="text-green-500" />
                            : <ToggleLeft size={22} className="text-gray-600" />}
                        </button>
                        <button onClick={() => setModal({ open: true, service: s })}
                          className="text-gray-400 hover:text-orange-400 transition-colors p-1">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteId(s.id)}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Название</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Описание</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Цена</th>
                  <th className="text-center text-xs text-gray-500 font-medium px-4 py-3">Длит.</th>
                  <th className="text-center text-xs text-gray-500 font-medium px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {services.map(s => (
                  <tr key={s.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{s.description}</td>
                    <td className="px-4 py-3 text-sm text-orange-400 font-medium text-right whitespace-nowrap">от {fmt(s.price)} ₸</td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs text-gray-400">
                        <Clock size={12} /> {s.duration} мин
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(s)} className="text-gray-400 hover:text-orange-400 transition-colors" title="Вкл/выкл">
                        {s.isActive
                          ? <ToggleRight size={22} className="text-green-500" />
                          : <ToggleLeft size={22} className="text-gray-600" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setModal({ open: true, service: s })}
                          className="text-gray-400 hover:text-orange-400 transition-colors p-1">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteId(s.id)}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal.open && (
        <ServiceModal
          initial={modal.service ? { name: modal.service.name, description: modal.service.description, price: modal.service.price, duration: modal.service.duration, isActive: modal.service.isActive, sortOrder: modal.service.sortOrder, imageUrl: modal.service.imageUrl } : empty()}
          onSave={handleSave}
          onClose={() => setModal({ open: false, service: null })}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm text-center">
            <p className="text-white mb-1">Удалить услугу?</p>
            <p className="text-gray-500 text-sm mb-5">«{services.find(s => s.id === deleteId)?.name}»</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-outline flex-1">Отмена</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
