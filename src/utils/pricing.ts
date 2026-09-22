import type { WarehouseItem } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Final price of an order = price of the services + oil (liters × price per liter) + whatever other
 * warehouse materials were picked at completion (antifreeze, freon, brake fluid, ...).
 * `servicePrices` are the per-service amounts entered by the master.
 */
export function calcOrderTotal(
  servicePrices: Record<string, string | number>,
  oilItem: Pick<WarehouseItem, 'price'> | undefined,
  liters: number,
  extraItems: { price: number; quantity: number }[] = [],
) {
  const servicesTotal = Object.values(servicePrices).reduce<number>((sum, p) => sum + (Number(p) || 0), 0)
  const pricePerLiter = oilItem?.price ?? 0
  const oilCost = oilItem && liters > 0 ? round2(liters * pricePerLiter) : 0
  const itemsCost = round2(extraItems.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0))
  return { servicesTotal, pricePerLiter, oilCost, itemsCost, total: round2(servicesTotal + oilCost + itemsCost) }
}

export const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`
