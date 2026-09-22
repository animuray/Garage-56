import type { WarehouseItem } from '../types'

// Shared warehouse category colours, so a filter chip on the Склад page and a material row in
// CompleteOrderModal always mean the same colour.
export const CATEGORY_COLORS: Record<WarehouseItem['category'], string> = {
  oil: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  filter: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  antifreeze: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  freon: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  brake_fluid: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  other: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
}

export const CATEGORY_DOT: Record<WarehouseItem['category'], string> = {
  oil: 'bg-blue-400',
  filter: 'bg-orange-400',
  antifreeze: 'bg-cyan-400',
  freon: 'bg-purple-400',
  brake_fluid: 'bg-yellow-400',
  other: 'bg-gray-400',
}
