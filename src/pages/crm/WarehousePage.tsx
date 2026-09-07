import { useState } from 'react'
import { Search, X, AlertTriangle, Plus, Pencil, Trash2, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { WarehouseItem } from '../../types'

const CATEGORY_LABELS: Record<string, string> = {
  oil: 'Масла', filter: 'Фильтры', antifreeze: 'Антифриз',
  freon: 'Фреон', brake_fluid: 'Тормозная жидкость', other: 'Другое',
}
const CATEGORY_COLORS: Record<string, string> = {
  oil: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  filter: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  antifreeze: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  freon: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  brake_fluid: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  other: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS) as WarehouseItem['category'][]

function StockBar({ quantity, min }: { quantity: number; min: number }) {
  const pct = Math.min((quantity / (min * 2)) * 100, 100)
  const color = quantity <= min ? 'bg-red-500' : quantity <= min * 1.5 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden w-20">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

type ItemForm = Omit<WarehouseItem, 'id'>
const EMPTY_FORM: ItemForm = {
  name: '', category: 'oil', quantity: 0, unit: 'л', minQuantity: 0, price: 0, brand: '',
}

const FInput = ({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string | number; onChange: (v: string) => void
  placeholder?: string; type?: string
}) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1 font-medium">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="input-field text-sm" />
  </div>
)

function ItemModal({ item, onClose, onSave }: {
  item?: WarehouseItem
  onClose: () => void
  onSave: (form: ItemForm) => Promise<void>
}) {
  const [form, setForm] = useState<ItemForm>(
    item ? { name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, minQuantity: item.minQuantity, price: item.price, brand: item.brand ?? '' }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof ItemForm) => (v: string) => setForm(p => ({ ...p, [k]: k === 'quantity' || k === 'minQuantity' || k === 'price' ? Number(v) : v }))

  const handleSave = async () => {
    if (!form.name || !form.unit) { setError('Укажите наименование и единицу измерения'); return }
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
          <h3 className="font-semibold text-white">{item ? 'Редактировать позицию' : 'Добавить позицию'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <FInput label="Наименование *" value={form.name} onChange={set('name')} placeholder="Shell Helix Ultra" />
          <FInput label="Бренд" value={form.brand ?? ''} onChange={set('brand')} placeholder="Shell" />
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-medium">Категория</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as WarehouseItem['category'] }))}
              className="input-field text-sm">
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FInput label="Количество" type="number" value={form.quantity} onChange={set('quantity')} placeholder="0" />
            <FInput label="Ед. измерения *" value={form.unit} onChange={set('unit')} placeholder="л / шт" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FInput label="Минимальный остаток" type="number" value={form.minQuantity} onChange={set('minQuantity')} placeholder="0" />
            <FInput label="Цена за ед. (₸)" type="number" value={form.price} onChange={set('price')} placeholder="0" />
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

export default function WarehousePage() {
  const { warehouse, addWarehouseItem, updateWarehouseItem, deleteWarehouseItem } = useApp()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modal, setModal] = useState<'add' | WarehouseItem | null>(null)
  const [deleting, setDeleting] = useState<WarehouseItem | null>(null)

  const categories = ['all', ...Array.from(new Set(warehouse.map(i => i.category)))]

  const filtered = warehouse.filter(item => {
    const q = search.toLowerCase()
    const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.brand ?? '').toLowerCase().includes(q)
    const matchCat = categoryFilter === 'all' || item.category === categoryFilter
    return matchSearch && matchCat
  })

  const lowStock = warehouse.filter(i => i.quantity <= i.minQuantity)
  const totalValue = warehouse.reduce((s, i) => s + i.quantity * i.price, 0)

  const handleSave = async (form: ItemForm) => {
    if (modal === 'add') {
      await addWarehouseItem(form)
    } else if (modal) {
      await updateWarehouseItem(modal.id, form)
    }
  }

  const handleDelete = async (item: WarehouseItem) => {
    await deleteWarehouseItem(item.id)
    setDeleting(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-white">Склад</h1>
        <button onClick={() => setModal('add')} className="btn-orange flex items-center gap-2 text-sm">
          <Plus size={15} /> Добавить
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
            <AlertTriangle size={16} /> Необходима закупка ({lowStock.length} позиций)
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(item => (
              <span key={item.id} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full">
                {item.name}: {item.quantity} {item.unit} (мин. {item.minQuantity})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-gray-500 text-xs mb-1">Всего позиций</div>
          <div className="text-white font-bold text-xl">{warehouse.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-gray-500 text-xs mb-1">Стоимость склада</div>
          <div className="text-green-400 font-bold text-lg">{totalValue.toLocaleString('ru-RU')} ₸</div>
        </div>
        <div className="card p-4">
          <div className="text-gray-500 text-xs mb-1">Требует закупки</div>
          <div className={`font-bold text-xl ${lowStock.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{lowStock.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-gray-500 text-xs mb-1">Масло (всего)</div>
          <div className="text-blue-400 font-bold text-xl">
            {warehouse.filter(i => i.category === 'oil').reduce((s, i) => s + i.quantity, 0)} л
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Название, бренд..." className="input-field !pl-10 text-sm" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${categoryFilter === cat ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white'}`}>
              {cat === 'all' ? 'Все' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="px-3 text-gray-400 hover:text-white border border-[#2a2a2a] rounded-lg">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[#2a2a2a]">
          {filtered.map(item => {
            const isLow = item.quantity <= item.minQuantity
            const isWarn = item.quantity <= item.minQuantity * 1.5 && !isLow
            return (
              <div key={item.id} className={`p-4 ${isLow ? 'bg-red-500/5' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-medium text-sm">{item.name}</span>
                      {item.brand && <span className="text-gray-500 text-xs">{item.brand}</span>}
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <AlertTriangle size={10} /> Закупить
                        </span>
                      ) : isWarn ? (
                        <span className="text-xs text-yellow-400">Мало</span>
                      ) : (
                        <span className="text-xs text-green-400">ОК</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs flex-wrap mb-2">
                      <span>
                        <span className="text-gray-500">Остаток: </span>
                        <span className={`font-semibold ${isLow ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-white'}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </span>
                      <span className="text-gray-500">мин. {item.minQuantity} {item.unit}</span>
                      <span className="text-gray-400">{item.price.toLocaleString('ru-RU')} ₸/ед.</span>
                    </div>
                    <StockBar quantity={item.quantity} min={item.minQuantity} />
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => setModal(item)} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleting(item)} className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-10">Позиций не найдено</div>
          )}
        </div>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
                <th className="text-left px-4 py-3 font-medium">Наименование</th>
                <th className="text-left px-4 py-3 font-medium">Категория</th>
                <th className="text-left px-4 py-3 font-medium">Остаток</th>
                <th className="text-left px-4 py-3 font-medium">Мин. остаток</th>
                <th className="text-left px-4 py-3 font-medium">Уровень</th>
                <th className="text-left px-4 py-3 font-medium">Цена / ед.</th>
                <th className="text-left px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = item.quantity <= item.minQuantity
                const isWarn = item.quantity <= item.minQuantity * 1.5 && !isLow
                return (
                  <tr key={item.id} className={`border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-sm">{item.name}</div>
                      {item.brand && <div className="text-gray-500 text-xs">{item.brand}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${CATEGORY_COLORS[item.category]}`}>
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${isLow ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-white'}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-500 text-xs">{item.minQuantity} {item.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StockBar quantity={item.quantity} min={item.minQuantity} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-xs">{item.price.toLocaleString('ru-RU')} ₸</span>
                    </td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> Закупить
                        </span>
                      ) : isWarn ? (
                        <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">Мало</span>
                      ) : (
                        <span className="text-xs text-green-400">ОК</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal(item)}
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleting(item)}
                          className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-600 py-10">Позиций не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ItemModal
          item={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="card w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-2">Удалить позицию?</h3>
            <p className="text-gray-400 text-sm mb-5">{deleting.name} — {deleting.quantity} {deleting.unit}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="btn-outline flex-1">Отмена</button>
              <button onClick={() => handleDelete(deleting)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-medium">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
