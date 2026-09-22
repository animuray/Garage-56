// Monthly report for a corporate client: summary + Excel + PDF.
// Source of truth is the `appointments` table (completed orders with the master's actual data).
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const path = require('path')

const FONT_DIR = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf')

const fmtDate = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}
const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ | /g, ' ')
const fmtLiters = (n) => Number((Number(n) || 0).toFixed(1)).toString().replace('.', ',')

const has = (s) => Boolean(s && String(s).trim())
const hasService = (row, re) => (row.services || []).some(s => re.test(s))

// The master now picks materials freely from the warehouse instead of a fixed oil/filter template,
// so a completed order carries `used_items` (any category, any count) rather than 3 fixed filter
// slots. Older orders (completed before this existed) only have the old oil_filter/air_filter/
// cabin_filter columns — count those as "1 filter" each so old reports still add up.
const usedItemsOf = (r) => Array.isArray(r.used_items) ? r.used_items : []
const filterCountOf = (r) => {
  const items = usedItemsOf(r)
  if (items.length) return items.filter(it => it.category === 'filter').length
  return [r.oil_filter, r.air_filter, r.cabin_filter].filter(has).length
}
const otherMaterialsCountOf = (r) => usedItemsOf(r).filter(it => it.category && it.category !== 'oil' && it.category !== 'filter').length

/** Turns DB rows into printable report lines + totals. */
function buildReport(rows, { from, to, company }) {
  const lines = rows.map((r, i) => {
    // Client-facing reports name the KIND of material only (oil / filters), never brands or part numbers
    const filterCount = filterCountOf(r)
    const otherCount = otherMaterialsCountOf(r)
    const materials = [
      (has(r.oil_brand) || Number(r.oil_liters) > 0) && 'Масло',
      filterCount > 0 && `Фильтры (${filterCount})`,
      otherCount > 0 && 'Другие материалы',
    ].filter(Boolean)
    return {
      n: i + 1,
      date: fmtDate(r.date),
      plate: r.license_plate,
      car: `${r.car_make} ${r.car_model}`.trim(),
      mileage: r.mileage || 0,
      works: (r.services || []).join(', '),
      materials: materials.join('; '),
      liters: r.oil_liters != null ? Number(r.oil_liters) : 0,
      oilCost: Number(r.oil_cost) || 0,
      master: r.master_name || '',
      total: Number(r.total) || 0,
    }
  })

  const cars = new Set(rows.map(r => r.car_id || r.license_plate))
  const byService = {}
  rows.forEach(r => (r.services || []).forEach(s => { byService[s] = (byService[s] || 0) + 1 }))

  const totals = {
    orders: rows.length,
    cars: cars.size,
    oilChanges: rows.filter(r => has(r.oil_brand) || hasService(r, /масл/i)).length,
    filtersChanged: rows.reduce((s, r) => s + filterCountOf(r), 0),
    otherMaterials: rows.reduce((s, r) => s + otherMaterialsCountOf(r), 0),
    oilLiters: rows.reduce((s, r) => s + (Number(r.oil_liters) || 0), 0),
    total: rows.reduce((s, r) => s + (Number(r.total) || 0), 0),
    oilCost: rows.reduce((s, r) => s + (Number(r.oil_cost) || 0), 0),
    byService: Object.entries(byService).sort((a, b) => b[1] - a[1]),
  }
  totals.worksCost = totals.total - totals.oilCost   // the order total is services + oil
  return { lines, totals, from, to, company }
}

const periodLabel = (from, to) => `${fmtDate(from)} — ${fmtDate(to)}`

const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const isFullMonth = (from, to) => {
  const [y, m] = from.split('-').map(Number)
  return from === `${y}-${String(m).padStart(2, '0')}-01` &&
    to === `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}
/** "Август 2026" for a whole month, "2026 год" for a whole year, otherwise the date range. */
function periodTitle(from, to) {
  if (isFullMonth(from, to)) return `${MONTHS_NOM[+from.slice(5, 7) - 1]} ${from.slice(0, 4)}`
  if (from === `${from.slice(0, 4)}-01-01` && to === `${from.slice(0, 4)}-12-31`) return `${from.slice(0, 4)} год`
  return periodLabel(from, to)
}
/** File-name friendly: 2026-08, 2026, or 2026-08-01_2026-08-15 */
function periodFileTag(from, to) {
  if (isFullMonth(from, to)) return from.slice(0, 7)
  if (from === `${from.slice(0, 4)}-01-01` && to === `${from.slice(0, 4)}-12-31`) return from.slice(0, 4)
  return `${from}_${to}`
}

// ─── Telegram text summary ───────────────────────────────────────────────────
function summaryText(rep, esc) {
  const t = rep.totals
  const LINE = '━━━━━━━━━━━━━━━'
  return [
    '📊 <b>Отчёт о выполненных работах</b>',
    `<i>${periodTitle(rep.from, rep.to)}</i>`,
    LINE,
    `🏢 <b>${esc(rep.company)}</b>`,
    '',
    `🚗 Обслужено автомобилей: <b>${t.cars}</b>`,
    `📦 Выполнено заказов: <b>${t.orders}</b>`,
    '',
    `🛢 Замен масла: <b>${t.oilChanges}</b> · расход <b>${fmtLiters(t.oilLiters)} л</b>`,
    `🔩 Заменено фильтров: <b>${t.filtersChanged}</b>`,
    ...(t.otherMaterials > 0 ? [`🧴 Другие материалы: <b>${t.otherMaterials}</b>`] : []),
    LINE,
    ...(t.oilCost > 0 ? [`🔧 Работы: <b>${fmtInt(t.worksCost)} ₸</b>`, `🛢 Масло: <b>${fmtInt(t.oilCost)} ₸</b>`] : []),
    `💰 <b>Итого: ${fmtInt(t.total)} ₸</b>`,
  ].join('\n')
}

// ─── Excel ───────────────────────────────────────────────────────────────────
async function buildExcel(rep) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Garage 56'
  const ws = wb.addWorksheet('Отчёт', { views: [{ state: 'frozen', ySplit: 5 }] })

  ws.columns = [
    { key: 'n', width: 5 }, { key: 'date', width: 12 }, { key: 'plate', width: 13 },
    { key: 'car', width: 22 }, { key: 'mileage', width: 12 }, { key: 'works', width: 42 },
    { key: 'materials', width: 46 }, { key: 'liters', width: 10 }, { key: 'oilCost', width: 13 },
    { key: 'master', width: 22 }, { key: 'total', width: 14 },
  ]

  ws.mergeCells('A1:K1')
  ws.getCell('A1').value = 'Отчёт о выполненных работах — Garage 56'
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.mergeCells('A2:K2')
  ws.getCell('A2').value = `Клиент: ${rep.company}`
  ws.mergeCells('A3:K3')
  ws.getCell('A3').value = `Период: ${periodTitle(rep.from, rep.to)} (${periodLabel(rep.from, rep.to)})`

  const header = ws.getRow(5)
  header.values = ['№', 'Дата', 'Госномер', 'Автомобиль', 'Пробег, км', 'Работы', 'Масло / фильтры', 'Масло, л', 'Масло, ₸', 'Мастер', 'Сумма (работы + масло), ₸']
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  header.height = 32
  header.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
  })

  const first = 6
  rep.lines.forEach(l => {
    const row = ws.addRow({ ...l, liters: l.liters || null, oilCost: l.oilCost || null })
    row.alignment = { vertical: 'top', wrapText: true }
    row.getCell('mileage').numFmt = '#,##0'
    row.getCell('liters').numFmt = '0.0'
    row.getCell('oilCost').numFmt = '#,##0'
    row.getCell('total').numFmt = '#,##0'
    row.eachCell(c => { c.border = { bottom: { style: 'hair' } } })
  })
  const last = first + rep.lines.length - 1

  const totalRow = ws.addRow({ works: 'ИТОГО' })
  totalRow.font = { bold: true }
  if (rep.lines.length) {
    totalRow.getCell('liters').value = { formula: `SUM(H${first}:H${last})`, result: rep.totals.oilLiters }
    totalRow.getCell('oilCost').value = { formula: `SUM(I${first}:I${last})`, result: rep.totals.oilCost }
    totalRow.getCell('total').value = { formula: `SUM(K${first}:K${last})`, result: rep.totals.total }
  }
  totalRow.getCell('liters').numFmt = '0.0'
  totalRow.getCell('oilCost').numFmt = '#,##0'
  totalRow.getCell('total').numFmt = '#,##0'
  totalRow.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    c.border = { top: { style: 'medium' } }
  })

  ws.addRow([])
  const t = rep.totals
  const summary = [
    ['Обслужено автомобилей', t.cars],
    ['Выполнено заказов', t.orders],
    ['Замена масла', t.oilChanges],
    ['Заменено фильтров', t.filtersChanged],
    ['Другие материалы', t.otherMaterials],
    ['Расход масла, л', Number(t.oilLiters.toFixed(1))],
    ['Стоимость работ, ₸', t.worksCost],
    ['Стоимость масла, ₸', t.oilCost],
    ['Общая стоимость, ₸', t.total],
  ]
  summary.forEach(([label, value]) => {
    const r = ws.addRow({})
    r.getCell('materials').value = label
    r.getCell('materials').font = { bold: true }
    r.getCell('materials').alignment = { horizontal: 'right' }
    r.getCell('liters').value = value
    r.getCell('liters').numFmt = '#,##0.#'
  })
  if (t.byService.length) {
    ws.addRow([])
    const h = ws.addRow({})
    h.getCell('works').value = 'Услуги по видам'
    h.getCell('works').font = { bold: true }
    t.byService.forEach(([name, cnt]) => {
      const r = ws.addRow({})
      r.getCell('works').value = name
      r.getCell('liters').value = cnt
    })
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
function buildPdf(rep) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('R', path.join(FONT_DIR, 'DejaVuSans.ttf'))
    doc.registerFont('B', path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'))

    const cols = [
      { k: 'n', t: '№', w: 24, a: 'center' },
      { k: 'date', t: 'Дата', w: 56, a: 'left' },
      { k: 'plate', t: 'Госномер', w: 62, a: 'left' },
      { k: 'car', t: 'Автомобиль', w: 88, a: 'left' },
      { k: 'mileage', t: 'Пробег', w: 48, a: 'right' },
      { k: 'works', t: 'Работы', w: 126, a: 'left' },
      { k: 'materials', t: 'Масло / фильтры', w: 134, a: 'left' },
      { k: 'liters', t: 'Масло, л', w: 40, a: 'right' },
      { k: 'oilCost', t: 'Масло, ₸', w: 50, a: 'right' },
      { k: 'master', t: 'Мастер', w: 76, a: 'left' },
      { k: 'total', t: 'Сумма, ₸', w: 62, a: 'right' },
    ]
    const left = doc.page.margins.left
    const pad = 3
    const FS = 7.5

    // Brand logo in the bottom-right corner of every page; content stops above it.
    const LOGO = path.join(__dirname, 'assets', 'logo.png')
    const LOGO_SIZE = 52
    const drawLogo = () => doc.image(LOGO,
      doc.page.width - doc.page.margins.right - LOGO_SIZE,
      doc.page.height - doc.page.margins.bottom - LOGO_SIZE, { width: LOGO_SIZE })
    doc.on('pageAdded', drawLogo)
    drawLogo() // the first page already exists at this point
    const bottom = () => doc.page.height - doc.page.margins.bottom - LOGO_SIZE - 8

    const cellText = (l, c) => {
      const v = l[c.k]
      if (c.k === 'mileage' || c.k === 'total') return fmtInt(v)
      if (c.k === 'oilCost') return v ? fmtInt(v) : ''
      if (c.k === 'liters') return v ? fmtLiters(v) : ''
      return String(v ?? '')
    }

    const drawHeader = (y) => {
      doc.font('B').fontSize(FS)
      const h = 18
      doc.rect(left, y, cols.reduce((s, c) => s + c.w, 0), h).fill('#1F2937')
      let x = left
      cols.forEach(c => {
        doc.fillColor('#FFFFFF').text(c.t, x + pad, y + 5, { width: c.w - pad * 2, align: c.a === 'right' ? 'right' : 'left', lineBreak: false })
        x += c.w
      })
      doc.fillColor('#000000')
      return y + h
    }

    doc.font('B').fontSize(14).text('Отчёт о выполненных работах — Garage 56', left, 30)
    doc.font('R').fontSize(10)
      .text(`Клиент: ${rep.company}`, left, 52)
      .text(`Период: ${periodTitle(rep.from, rep.to)} (${periodLabel(rep.from, rep.to)})`, left, 66)

    let y = drawHeader(88)
    doc.font('R').fontSize(FS)

    rep.lines.forEach((l, idx) => {
      const heights = cols.map(c => doc.heightOfString(cellText(l, c), { width: c.w - pad * 2 }))
      const rowH = Math.max(...heights) + pad * 2
      if (y + rowH > bottom()) {
        doc.addPage()
        y = drawHeader(doc.page.margins.top)
        doc.font('R').fontSize(FS)
      }
      if (idx % 2) doc.rect(left, y, cols.reduce((s, c) => s + c.w, 0), rowH).fill('#F3F4F6').fillColor('#000000')
      let x = left
      cols.forEach(c => {
        doc.fillColor('#000000').text(cellText(l, c), x + pad, y + pad, { width: c.w - pad * 2, align: c.a })
        x += c.w
      })
      y += rowH
    })

    // ─ Totals ─
    const t = rep.totals
    const tw = cols.reduce((s, c) => s + c.w, 0)
    const blockH = 14 * 11 + 20   // a little more than the summary block actually needs — safe margin
    if (y + blockH > bottom()) { doc.addPage(); y = doc.page.margins.top }
    doc.moveTo(left, y + 4).lineTo(left + tw, y + 4).lineWidth(1).stroke('#000000')
    y += 12
    doc.font('B').fontSize(10).text('ИТОГО', left, y)
    y += 16
    const items = [
      ['Обслужено автомобилей', t.cars],
      ['Выполнено заказов', t.orders],
      ['Замена масла', t.oilChanges],
      ['Заменено фильтров', t.filtersChanged],
      ['Другие материалы', t.otherMaterials],
      ['Расход масла, л', fmtLiters(t.oilLiters)],
      ['Стоимость работ, ₸', fmtInt(t.worksCost)],
      ['Стоимость масла, ₸', fmtInt(t.oilCost)],
    ]
    doc.font('R').fontSize(9)
    items.forEach(([label, val]) => {
      doc.text(label, left, y, { width: 200, continued: false })
      doc.text(String(val), left + 200, y, { width: 80, align: 'right' })
      y += 13
    })
    y += 4
    doc.font('B').fontSize(11)
    doc.text('Общая стоимость, ₸', left, y, { width: 200 })
    doc.text(fmtInt(t.total), left + 200, y, { width: 80, align: 'right' })

    doc.end()
  })
}

module.exports = { buildReport, summaryText, buildExcel, buildPdf, fmtDate, fmtInt, fmtLiters, periodLabel, periodTitle, periodFileTag }
