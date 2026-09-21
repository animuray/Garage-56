import type { WarehouseItem } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Final price of an order = price of the services + oil (liters × price per liter from the warehouse).
 * `servicePrices` are the per-service amounts entered by the master.
 */
export function calcOrderTotal(
  servicePrices: Record<string, string | number>,
  oilItem: Pick<WarehouseItem, 'price'> | undefined,
  liters: number,
) {
  const servicesTotal = Object.values(servicePrices).reduce<number>((sum, p) => sum + (Number(p) || 0), 0)
  const pricePerLiter = oilItem?.price ?? 0
  const oilCost = oilItem && liters > 0 ? round2(liters * pricePerLiter) : 0
  return { servicesTotal, pricePerLiter, oilCost, total: round2(servicesTotal + oilCost) }
}

export const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`
