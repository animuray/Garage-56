import { useState } from 'react'
import { X, Check, Plus, Trash2, Wrench, PackagePlus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Appointment, UsedItem, WarehouseItem } from '../types'
import { calcOrderTotal, formatMoney } from '../utils/pricing'
import { CATEGORY_DOT } from '../utils/warehouseCategories'
import { Caption } from './ui'

const CATEGORY_LABELS: Record<WarehouseItem['category'], string> = {
  oil: 'Масло', filter: 'Фильтры', antifreeze: 'Антифриз', freon: 'Фреон', brake_fluid: 'Тормозная жидкость', other: 'Другое',
}

type Row = { key: string; itemId: string; quantity: string }
const round2 = (n: number) => Math.round(n * 100) / 100

// Shared by AppointmentsPage and MasterPage. Nothing is assumed to have been replaced — the master
// picks everything used (oil, filters, antifreeze, whatever) freely from the warehouse, one item at
// a time, instead of filling in a fixed set of fields.
export function CompleteOrderModal({ apt, onClose, onSave }: {
  apt: Appointment
  onClose: () => void
  onSave: (data: Partial<Appointment>) => Promise<void>
}) {
  const { warehouse, updateWarehouseItem } = useApp()

  const [rows, setRows] = useState<Row[]>([])
  const [pickId, setPickId] = useState('')
  const [notes, setNotes] = useState('')
  const [servicePrices, setServicePrices] = useState<Record<string, string>>(
    Object.fromEntries((apt.services ?? []).map(s => [s, '']))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const available = warehouse.filter(i => !rows.some(r => r.itemId === i.id))
  const grouped = (Object.keys(CATEGORY_LABELS) as WarehouseItem['category'][])
    .map(cat => ({ cat, items: available.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const extraItems = rows.map(r => {
    const item = warehouse.find(i => i.id === r.itemId)
    return { price: item?.price ?? 0, quantity: Number(r.quantity) || 0 }
  })
  const { servicesTotal, itemsCost, total } = calcOrderTotal(servicePrices, undefined, 0, extraItems)

  const addRow = () => {
    if (!pickId) return
    setRows(prev => [...prev, { key: `${pickId}-${Date.now()}`, itemId: pickId, quantity: '1' }])
    setPickId('')
  }
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key))
  const setRowQty = (key: string, quantity: string) => setRows(prev => prev.map(r => r.key === key ? { ...r, quantity } : r))

  const getValidationError = (): string | null => {
    for (const r of rows) {
      const qty = Number(r.quantity)
      if (!r.quantity.trim() || isNaN(qty) || qty <= 0) return 'Укажите количество для каждой добавленной позиции'
      if (qty > 999) return 'Слишком большое количество — проверьте значение'
    }
    return null
  }

  const validationError = getValidationError()

  const handleSave = async () => {
    if (validationError || saving) return
    const parsedPrices = Object.fromEntries(Object.entries(servicePrices).map(([k, v]) => [k, Number(v) || 0]))
    const items: UsedItem[] = rows.map(r => {
      const w = warehouse.find(i => i.id === r.itemId)!
      const quantity = Number(r.quantity) || 0
      return { name: w.name, category: w.category, brand: w.brand, quantity, unit: w.unit, pricePerUnit: w.price, cost: round2(w.price * quantity) }
    })
    // Oil still gets its own summary (brand/viscosity/liters/cost) for the corporate reports — derived
    // from whatever oil item(s) were picked in the list above, not from a separate fixed field.
    const oilItems = items.filter(it => it.category === 'oil')
    const oil = oilItems.length ? {
      brand: oilItems[0].brand ?? oilItems[0].name,
      viscosity: oilItems.map(o => o.name).join(', '),
      liters: round2(oilItems.reduce((s, o) => s + o.quantity, 0)),
      pricePerLiter: oilItems[0].pricePerUnit,
      cost: round2(oilItems.reduce((s, o) => s + o.cost, 0)),
    } : undefined

    setSaving(true)
    setError('')
    try {
      await onSave({
        status: 'completed',
        total,
        serviceRecord: { oil, items: items.length ? items : undefined, notes, total, servicePrices: parsedPrices },
      })
      for (const r of rows) {
        const w = warehouse.find(i => i.id === r.itemId)
        if (!w) continue
        const { id, ...rest } = w
        await updateWarehouseItem(id, { ...rest, quantity: Math.max(0, w.quantity - (Number(r.quantity) || 0)) })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.toLowerCase().includes('overflow') || msg.includes('переполн')) {
        setError('Одно из числовых значений слишком большое. Проверьте количество и стоимость услуг.')
      } else {
        setError(msg || 'Не удалось сохранить. Попробуйте ещё раз.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Завершить заказ</h3>
          <button onClick={onClose} disabled={saving} className="text-gray-500 hover:text-white disabled:opacity-40"><X size={18} /></button>
        </div>
        <div className="text-sm text-gray-400 mb-4">
          {apt.carMake} {apt.carModel} · {apt.licensePlate} · {apt.clientName}
        </div>
        <div className="space-y-5">
          {/* Everything used on the job — added one at a time from the warehouse, nothing assumed */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <PackagePlus size={13} className="text-gray-500" />
              <Caption>Что использовали со склада</Caption>
            </div>
            {rows.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {rows.map(r => {
                  const item = warehouse.find(i => i.id === r.itemId)
                  if (!item) return null
                  const qty = Number(r.quantity) || 0
                  return (
                    <div key={r.key} className="flex items-center gap-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg pl-3 pr-2.5 py-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_DOT[item.category]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-100 text-sm truncate">{item.brand ? `${item.brand} · ` : ''}{item.name}</div>
                        <div className="text-gray-500 text-xs">{CATEGORY_LABELS[item.category]} · {formatMoney(item.price)}/{item.unit}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input type="number" min="0.1" step="0.1" value={r.quantity} onChange={e => setRowQty(r.key, e.target.value)}
                          className="input-field !w-16 !py-1.5 text-sm text-center" />
                        <span className="text-gray-500 text-xs w-6">{item.unit}</span>
                      </div>
                      <span className="text-white text-sm font-semibold w-24 text-right shrink-0">{formatMoney(item.price * qty)}</span>
                      <button onClick={() => removeRow(r.key)} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded p-1.5 shrink-0 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2">
              <select value={pickId} onChange={e => setPickId(e.target.value)}
                className={`input-field text-sm appearance-none flex-1 ${!pickId ? 'text-gray-500' : ''}`}>
                <option value="">— Выбрать со склада —</option>
                {grouped.map(g => (
                  <optgroup key={g.cat} label={CATEGORY_LABELS[g.cat]}>
                    {g.items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.brand ? `${item.brand} · ` : ''}{item.name} ({item.quantity} {item.unit})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" onClick={addRow} disabled={!pickId}
                className="btn-outline px-3 flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                <Plus size={14} /> Добавить
              </button>
            </div>
            {warehouse.length === 0 && <div className="text-xs text-yellow-400 mt-1.5">На складе пока пусто — добавьте позиции на вкладке «Склад»</div>}
            {rows.length === 0 && warehouse.length > 0 && (
              <div className="text-xs text-gray-600 mt-1.5">Если для этого заказа ничего со склада не понадобилось — оставьте список пустым.</div>
            )}
          </div>

          <div>
            <Caption>Комментарий</Caption>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field text-sm resize-none" rows={2} placeholder="Комментарий мастера..." />
          </div>

          {/* Per-service labour prices — separate from the materials above */}
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Wrench size={13} className="text-gray-500" />
              <Caption>Стоимость работы мастера</Caption>
            </div>
            <div className="text-xs text-gray-600 mb-2">Необязательно. Оплата за саму работу — материалы уже посчитаны выше</div>
            <div className="space-y-2">
              {(apt.services ?? []).map(s => (
                <div key={s}>
                  <label className="text-xs text-gray-500 block mb-1">{s}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={servicePrices[s] ?? ''}
                      onChange={e => setServicePrices(prev => ({ ...prev, [s]: e.target.value }))}
                      className="input-field flex-1" placeholder="Стоимость работы" />
                    <span className="text-gray-500 text-sm shrink-0">₸</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Работа мастера</span>
                <span className="text-gray-300">{formatMoney(servicesTotal)}</span>
              </div>
              {rows.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Материалы со склада</span>
                  <span className="text-gray-300">{formatMoney(itemsCost)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-[#2a2a2a]">
                <span className="text-gray-400 font-medium">Итого</span>
                <span className="text-white font-bold text-base">{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </div>
        {(validationError || error) && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error || validationError}
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={saving} className="btn-outline flex-1 disabled:opacity-40">Отмена</button>
          <button onClick={handleSave} disabled={!!validationError || saving}
            className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
