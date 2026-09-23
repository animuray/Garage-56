// Garage 56 — Telegram bot for corporate clients (taxi fleets). MVP.
// Runs inside the API process and uses the same PostgreSQL database as the CRM and the site.
const fs = require('fs')
const path = require('path')
const { Bot, InlineKeyboard, Keyboard, InputFile } = require('grammy')
const { pool } = require('../db')
const data = require('./data')
const R = require('./report')

let bot = null
let botUsername = null
let sendPush = () => {}   // notifyStaff({ kind, title, body, url, … }) from server.js: live CRM toast + browser push

// ─── Helpers ─────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmtInt = R.fmtInt
const fmtDate = R.fmtDate
const hm = (t) => String(t).slice(0, 5)
const pad2 = (n) => String(n).padStart(2, '0')
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const longDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_GEN[m - 1]}` }
const weekday = (iso) => WEEKDAYS[new Date(iso + 'T00:00:00Z').getUTCDay()]
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const parseNum = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'))
const FUELS = ['Бензин', 'Дизель', 'Газ', 'Гибрид', 'Электро']

// Look & feel: one heading style, one divider, the same icons for the same things everywhere
const LINE = '━━━━━━━━━━━━━━━'
const SOFT = '┄┄┄┄┄┄┄┄┄┄┄┄'
const head = (icon, title, sub) => `${icon} <b>${title}</b>${sub ? `\n<i>${sub}</i>` : ''}\n${LINE}\n`
const carName = (c) => `${esc(c.make)} ${esc(c.model)}`.trim()

// telegram id → { mode, draft, q, screen (id of the current screen message), extra (id of the list message under it),
//                 keys (bottom button label → action), kbSig }
const sessions = new Map()
const sess = (ctx) => {
  let s = sessions.get(ctx.from.id)
  if (!s) { s = { mode: null, draft: null, q: '', screen: null, extra: null, keys: new Map(), kbSig: '' }; sessions.set(ctx.from.id, s) }
  return s
}

const codeAttempts = new Map() // telegram id → { n, until }
const CODE_MAX_ATTEMPTS = 5
const CODE_BLOCK_MS = 15 * 60 * 1000

/**
 * UI model
 *  - Actions (menu, next, cancel, confirm, dates, time…) are buttons of the keyboard pinned under the input
 *    field. Screens describe them with an InlineKeyboard (rows of labelled actions); `show` renders it as the
 *    bottom keyboard and remembers label → action, so a tap (a plain text message) is routed like a callback.
 *  - Long lists (cars) are shown IN the chat as inline buttons under the screen, so they can be scrolled
 *    and picked without cluttering the bottom panel (`inline` option).
 *  - The chat holds one screen (a message, plus its list message if any). It is replaced when a new screen is
 *    shown, and the user's own taps/typing are deleted (middleware). A bottom keyboard can only be attached to
 *    a new message, so a screen with different bottom buttons is a new message; identical buttons only edit.
 *  - `fresh` (/start, /menu) always sends a new screen at the bottom.
 */
const MENU_ACTIONS = new Set(['menu', 'car|addcancel'])   // actions that already lead back to the home screen

function toBottomKeyboard(inline, { addMenu = false, placeholder = null } = {}) {
  const keys = new Map()   // label → action ('noop' for decorative buttons)
  const rows = []
  const sourceRows = [...inline.inline_keyboard]
  // Every screen must offer a way back home
  if (addMenu && !sourceRows.flat().some(b => MENU_ACTIONS.has(b.callback_data))) {
    sourceRows.push([{ text: '🏠 Меню', callback_data: 'menu' }])
  }
  for (const row of sourceRows) {
    rows.push(row.map(btn => {
      const action = btn.callback_data || 'noop'
      let label = String(btn.text).trim() || '·'   // reply keyboards can't have empty buttons
      if (action === 'noop') { if (!keys.has(label)) keys.set(label, 'noop') } else {
        while (keys.has(label) && keys.get(label) !== action) label += '.'   // labels must be unique per screen
        keys.set(label, action)
      }
      return label
    }))
  }
  const keyboard = new Keyboard()
  rows.forEach((labels, i) => { labels.forEach(l => keyboard.text(l)); if (i < rows.length - 1) keyboard.row() })
  keyboard.resized().persistent()
  if (placeholder) keyboard.placeholder(placeholder)
  return { keyboard, keys, sig: JSON.stringify([[...keys], rows, placeholder]) }
}

const isNotModified = (e) => /not modified/i.test(e?.description || e?.message || '')

async function show(ctx, text, kb, { fresh = false, home = false, inline = null, placeholder = null } = {}) {
  const s = sess(ctx)
  const chatId = ctx.chat.id
  const base = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
  const cbId = ctx.callbackQuery?.message?.message_id ?? null
  // a tap on a message that isn't the current screen (e.g. an old inline menu from before) → replace it
  const legacy = cbId && cbId !== s.screen && cbId !== s.extra ? cbId : null

  let keyboard = null, sig = s.kbSig
  if (kb) {
    const b = toBottomKeyboard(kb, { addMenu: !!ctx.org && !home, placeholder })
    keyboard = b.keyboard; s.keys = b.keys; sig = b.sig
  }
  const sendExtra = async () => {
    const m = await ctx.api.sendMessage(chatId, inline.text, { ...base, reply_markup: inline.kb })
    s.extra = m.message_id
  }

  // same bottom buttons as the current screen → update in place, no new message
  if (!fresh && !legacy && s.screen && (!kb || sig === s.kbSig)) {
    let edited = true
    try { await ctx.api.editMessageText(chatId, s.screen, text, base) } catch (e) { if (!isNotModified(e)) edited = false }
    if (edited) {
      if (inline) {
        if (s.extra) {
          try { await ctx.api.editMessageText(chatId, s.extra, inline.text, { ...base, reply_markup: inline.kb }) } catch (e) {
            if (!isNotModified(e)) { ctx.api.deleteMessage(chatId, s.extra).catch(() => {}); await sendExtra() }
          }
        } else await sendExtra()
      } else if (s.extra) { ctx.api.deleteMessage(chatId, s.extra).catch(() => {}); s.extra = null }
      return
    }
  }

  const stale = [s.screen, s.extra, legacy]
  s.extra = null
  const sent = await ctx.api.sendMessage(chatId, text, keyboard ? { ...base, reply_markup: keyboard } : base)
  s.screen = sent.message_id; s.kbSig = sig
  if (inline) await sendExtra()
  for (const id of stale) if (id && id !== s.screen && id !== s.extra) ctx.api.deleteMessage(chatId, id).catch(() => {})
}

const menuBtn = (kb) => kb.row().text('🏠 Меню', 'menu')

// Main sections (the buttons of the home screen)
const NAV = {
  cars: '🚗 Мои автомобили', book: '📅 Записаться', apts: '📋 Мои записи',
  tb: '📖 Техническая книжка', rep: '📊 Отчёты', org: '🏢 Данные таксопарка',
}
const NAV_ACTION = {
  [NAV.cars]: 'cl|cars|0', [NAV.book]: 'book', [NAV.apts]: 'apts',
  [NAV.tb]: 'cl|tb|0', [NAV.rep]: 'rep', [NAV.org]: 'org',
}
const homeKeyboard = () => new InlineKeyboard()
  .text(NAV.cars, NAV_ACTION[NAV.cars]).text(NAV.book, NAV_ACTION[NAV.book]).row()
  .text(NAV.apts, NAV_ACTION[NAV.apts]).text(NAV.tb, NAV_ACTION[NAV.tb]).row()
  .text(NAV.rep, NAV_ACTION[NAV.rep]).text(NAV.org, NAV_ACTION[NAV.org])

// ─── Authorization ───────────────────────────────────────────────────────────
async function showWelcome(ctx, opts) {
  sess(ctx).mode = null
  const kb = new InlineKeyboard().text('🔑 Войти по коду', 'auth|login').row()
    .text('📝 Получить доступ', 'auth|access').text('📞 Связаться', 'auth|contact')
  await show(ctx,
    head('🏁', 'GARAGE 56', 'Обслуживание корпоративных автопарков') +
    '\nДобро пожаловать! Здесь вы записываете автомобили на обслуживание, смотрите техническую книжку ' +
    'и получаете отчёты для бухгалтерии.\n\nВойдите по коду подключения, который выдал администратор.', kb, opts)
}

async function askCode(ctx, warn) {
  sess(ctx).mode = 'code'
  await show(ctx,
    (warn ? `⚠️ ${warn}\n\n` : '') + head('🔑', 'Вход') +
    '\nВведите код подключения, который вам выдал Garage 56.',
    new InlineKeyboard().text('◀️ Назад', 'auth|back').text('📞 Связаться', 'auth|contact'),
    { placeholder: 'Код подключения' })
}

async function showAccessInfo(ctx) {
  const kb = new InlineKeyboard().text('🔑 У меня есть код', 'auth|login').text('📞 Связаться с Garage 56', 'auth|contact')
  await show(ctx,
    head('📝', 'Как получить доступ') +
    '\nДоступ выдаёт администратор Garage 56: он создаёт вашу организацию и присылает одноразовый код подключения.\n' +
    '\nНет кода или не знаете, к кому обратиться, — нажмите «Связаться».\n\nПолучили код — нажмите кнопку ниже.', kb)
}

/** Phone/email/address/social — whatever is filled in on the CRM's "Настройки" page. */
async function showContact(ctx) {
  const st = await data.getSettings()
  const lines = [
    st.phone && `📞 <code>${esc(st.phone)}</code>`,
    st.email && `✉️ ${esc(st.email)}`,
    st.address && `📍 ${esc(st.address)}`,
    ...(st.socialLinks || []).filter(l => l?.name && l?.url).map(l => `🔗 ${esc(l.name)}: ${esc(l.url)}`),
  ].filter(Boolean)
  const kb = new InlineKeyboard().text('◀️ Назад', 'auth|access')
  await show(ctx,
    head('📞', 'Связаться с Garage 56') +
    (lines.length
      ? '\n' + lines.join('\n') + '\n\n<i>Напишите или позвоните — поможем с кодом подключения и ответим на вопросы.</i>'
      : '\n⚠️ Контакты пока не заполнены в настройках CRM (раздел «Настройки» → «Контакты»). Уточните их у своего представителя Garage 56.'),
    kb)
}

const normalizeCode = (t) => {
  const m = String(t).trim().toUpperCase().match(/^(?:G56)?[-\s]?(\d{6})$/)
  return m ? `G56-${m[1]}` : null
}

async function tryLink(ctx, rawCode, opts) {
  const id = ctx.from.id
  const a = codeAttempts.get(id)
  if (a && a.n >= CODE_MAX_ATTEMPTS && a.until > Date.now()) {
    return askCode(ctx, 'Слишком много неверных попыток. Попробуйте через 15 минут или свяжитесь с Garage 56.')
  }
  const code = normalizeCode(rawCode)
  const corpId = code ? await data.linkByCode(ctx.from, code) : null
  if (!corpId) {
    const n = ((a && a.until > Date.now()) ? a.n : 0) + 1
    codeAttempts.set(id, { n, until: Date.now() + CODE_BLOCK_MS })
    return askCode(ctx, 'Код не найден, уже использован или истёк. Проверьте код или запросите новый у администратора Garage 56.')
  }
  codeAttempts.delete(id)
  sess(ctx).mode = null
  ctx.org = await data.getOrgByTelegramId(id)
  sendPush({ kind: 'bot_linked', title: 'Таксопарк подключился к боту',
    body: `${ctx.org.company_name} · ${ctx.org.user_name || 'сотрудник'}`, url: '/crm/corporate' })
  await showMenu(ctx, `✅ Готово! Вы подключены к организации <b>${esc(ctx.org.company_name)}</b>.`, opts)
}

// ─── Main menu ───────────────────────────────────────────────────────────────
async function showMenu(ctx, note, opts) {
  const s = sess(ctx); s.mode = null; s.draft = null; s.q = ''
  const st = await data.getOrgStats(ctx.org.corporate_id)
  await show(ctx,
    (note ? `${note}\n\n` : '') +
    head('🏢', esc(ctx.org.company_name), 'Личный кабинет Garage 56') + '\n' +
    `🚗  Автомобилей: <b>${st.cars}</b>\n` +
    `🔧  Обслужено в этом месяце: <b>${st.doneMonth}</b>\n` +
    `📅  Активных записей: <b>${st.active}</b>\n\n` +
    '<i>Выберите раздел в меню ниже 👇</i>',
    homeKeyboard(), { ...opts, home: true })
}

// ─── Cars ────────────────────────────────────────────────────────────────────
const CL_TITLE = {
  cars: ['🚗', 'Мои автомобили', 'Нажмите на автомобиль, чтобы открыть карточку'],
  tb: ['📖', 'Техническая книжка', 'Выберите автомобиль, чтобы увидеть историю обслуживания'],
  book: ['📅', 'Запись на обслуживание', 'Выберите автомобиль'],
}
const PAGE = 8

async function showCarList(ctx, mode, offset = 0) {
  const s = sess(ctx)
  const { rows, total } = await data.listCars(ctx.org.corporate_id, { q: s.q, offset, limit: PAGE })
  const [icon, title, hint] = CL_TITLE[mode]

  // actions: bottom keyboard — main actions together on top, Меню always its own row at the bottom.
  // Booking picks from the EXISTING fleet — adding a car isn't offered on this screen.
  const kb = new InlineKeyboard()
  if (mode !== 'tb' && mode !== 'book') kb.text('➕ Добавить автомобиль', `car|add|${mode}`)
  kb.text('🔍 Найти автомобиль', `find|${mode}`)
  if (s.q) kb.text('✖️ Сбросить поиск', `clr|${mode}`)
  menuBtn(kb)

  let text = head(icon, title) + `\nВсего автомобилей: <b>${total}</b>`
  if (s.q) text += `\n🔍 Поиск: <b>«${esc(s.q)}»</b>`
  if (!total) {
    if (s.q) text += '\n\nНичего не найдено — попробуйте другой запрос.'
    else if (mode === 'book') text += '\n\nПока нет автомобилей. Добавьте первый в разделе «Мои автомобили».'
    else text += '\n\nПока нет автомобилей. Добавьте первый или попросите Garage 56 загрузить список из Excel.'
  }

  // the list itself: inline buttons in the chat (scrollable, doesn't overload the bottom panel)
  let inline = null
  if (total) {
    const list = new InlineKeyboard()
    const pick = mode === 'book' ? 'bk|car|' : 'car|'
    rows.forEach(c => list.text(`🚗 ${c.make} ${c.model} · ${c.license_plate}`, pick + c.id).row())
    const pages = Math.max(1, Math.ceil(total / PAGE)), page = Math.floor(offset / PAGE)
    if (pages > 1) {
      list.text('◀️ Назад', page > 0 ? `cl|${mode}|${offset - PAGE}` : 'noop')
      list.text(`${page + 1} / ${pages}`, 'noop')
      list.text('Вперёд ▶️', page < pages - 1 ? `cl|${mode}|${offset + PAGE}` : 'noop')
    }
    inline = { text: `👇 <b>${hint}</b>`, kb: list }
  }
  await show(ctx, text, kb, { inline })
}

async function showCar(ctx, carId) {
  const car = await data.getCar(ctx.org.corporate_id, carId)
  if (!car) return show(ctx, 'Автомобиль не найден.', menuBtn(new InlineKeyboard()))
  const sum = await data.getCarBookSummary(car.id)
  const delReq = await data.getPendingDeleteRequest(car.id)
  const engine = [Number(car.engine_volume) ? Number(car.engine_volume).toFixed(1) : null, car.engine_type].filter(Boolean).join(' · ')
  const lines = [
    head('🚗', carName(car), `<code>${esc(car.license_plate)}</code> · ${car.year} г.`),
    engine ? `⚙️ Двигатель: <b>${esc(engine)}</b>` : null,
    `🛣 Пробег: <b>${fmtInt(car.mileage)} км</b>`,
    '',
    '🔧 <b>Обслуживание</b>',
    `▫️ Визитов в сервис: <b>${sum.visits}</b>`,
    `▫️ Замен масла: <b>${sum.oilChanges}</b>`,
    `▫️ Последнее ТО: ${sum.last ? `<b>${fmtDate(sum.last.date)}</b>${sum.last.mileage ? ` · ${fmtInt(sum.last.mileage)} км` : ''}` : '—'}`,
    car.next_service ? `▫️ Следующее ТО: <b>${fmtDate(car.next_service)}</b>` : null,
    delReq ? `\n🗑 <b>Запрос на удаление отправлен</b>\n<i>Ожидает решения администратора Garage 56.</i>` : null,
  ].filter(l => l !== null)
  const kb = new InlineKeyboard()
    .text('📖 История обслуживания', `hist|${car.id}|0`).row()
    .text('📅 Записать на ТО', `bk|car|${car.id}`).text('🚗 К списку', 'cl|cars|0')
  if (!delReq) kb.row().text('🗑 Запросить удаление', `cdr|ask|${car.id}`)
  menuBtn(kb)
  await show(ctx, lines.join('\n'), kb)
}

/** The client can't bring an archived car back itself: this only sends a request to the CRM. */
async function sendRestoreRequest(ctx, carId) {
  const { rows: [car] } = await pool.query(
    'SELECT id, corporate_id, make, model, license_plate, archived_at FROM cars WHERE id = $1', [carId])
  // only the company's OWN archived car
  if (!car || car.corporate_id !== ctx.org.corporate_id || !car.archived_at) {
    return show(ctx, 'Автомобиль не найден в архиве.', menuBtn(new InlineKeyboard()))
  }
  sess(ctx).mode = null; sess(ctx).draft = null
  const id = await data.createDeleteRequest(ctx.org, car, '', ctx.from.id, 'restore')
  const carLine = `🚗 <b>${carName(car)}</b> · <code>${esc(car.license_plate)}</code>`
  if (!id) {
    return show(ctx, head('⏳', 'Запрос уже отправлен') + `\n${carLine}\n\nАдминистратор рассматривает восстановление.`, menuBtn(new InlineKeyboard()))
  }
  sendPush({ kind: 'car_request', requestKind: 'restore', requestId: String(id), title: 'Запрос на восстановление автомобиля',
    body: `${ctx.org.company_name} · ${car.make} ${car.model} · ${car.license_plate}`, url: '/crm/corporate' })
  await show(ctx,
    head('📨', 'Запрос на восстановление отправлен') + `\n${carLine}\n\n` +
    'Администратор Garage 56 рассмотрит запрос. Как только автомобиль вернут в автопарк — пришлём уведомление. История обслуживания сохранена.',
    new InlineKeyboard().text('🏠 Меню', 'menu'))
}

// ─── Request to delete a car: the client can't delete, only ask the administrator ───
async function askDeleteReason(ctx, carId) {
  const car = await data.getCar(ctx.org.corporate_id, carId)
  if (!car) return show(ctx, 'Автомобиль не найден.', menuBtn(new InlineKeyboard()))
  if (await data.getPendingDeleteRequest(car.id)) return showCar(ctx, car.id)
  const s = sess(ctx)
  s.mode = 'delreason'
  s.draft = { kind: 'delreq', carId: car.id, reason: '' }
  await show(ctx,
    head('🗑', 'Запрос на удаление', `${carName(car)} · ${esc(car.license_plate)}`) +
    '\nАвтомобиль удаляет только администратор Garage 56 — вы отправляете ему запрос.\n\n' +
    '✍️ <b>Укажите причину</b> (например, «продан» или «списан») или отправьте без причины.',
    new InlineKeyboard().text('⏭ Без причины', 'cdr|noreason').text('◀️ Отмена', `car|${car.id}`),
    { placeholder: 'Причина, например: автомобиль продан' })
}

async function confirmDeleteRequest(ctx) {
  const d = sess(ctx).draft
  if (d?.kind !== 'delreq') return show(ctx, '⌛ Сессия устарела.', menuBtn(new InlineKeyboard()))
  const car = await data.getCar(ctx.org.corporate_id, d.carId)
  if (!car) return show(ctx, 'Автомобиль не найден.', menuBtn(new InlineKeyboard()))
  sess(ctx).mode = null
  await show(ctx,
    head('🗑', 'Отправить запрос на удаление?') + '\n' +
    `🚗 <b>${carName(car)}</b> · <code>${esc(car.license_plate)}</code>\n` +
    `📝 Причина: ${d.reason ? `<i>«${esc(d.reason)}»</i>` : '—'}\n\n` +
    '<i>До решения администратора автомобиль остаётся в вашем списке. Мы пришлём уведомление, когда запрос будет рассмотрен.</i>',
    new InlineKeyboard().text('✅ Отправить запрос', 'cdr|send').text('❌ Отмена', `car|${car.id}`))
}

async function sendDeleteRequest(ctx) {
  const d = sess(ctx).draft
  if (d?.kind !== 'delreq') return show(ctx, '⌛ Сессия устарела.', menuBtn(new InlineKeyboard()))
  const car = await data.getCar(ctx.org.corporate_id, d.carId)
  if (!car) return show(ctx, 'Автомобиль не найден.', menuBtn(new InlineKeyboard()))
  const id = await data.createDeleteRequest(ctx.org, car, d.reason, ctx.from.id)
  sess(ctx).draft = null; sess(ctx).mode = null
  if (!id) return showCar(ctx, car.id)   // somebody from the same company has already asked
  sendPush({ kind: 'car_request', requestKind: 'delete', requestId: String(id), title: 'Запрос на удаление автомобиля',
    body: `${ctx.org.company_name} · ${car.make} ${car.model} · ${car.license_plate}${d.reason ? ' · ' + d.reason : ''}`, url: '/crm/corporate' })
  await show(ctx,
    head('📨', 'Запрос отправлен') + '\n' +
    `🚗 <b>${carName(car)}</b> · <code>${esc(car.license_plate)}</code>\n\n` +
    'Администратор Garage 56 рассмотрит запрос. Автомобиль останется в списке до решения — мы пришлём уведомление.',
    menuBtn(new InlineKeyboard().text('🚗 К автомобилю', `car|${car.id}`).text('📋 К списку', 'cl|cars|0')))
}

const HIST_PAGE = 4
async function showHistory(ctx, carId, offset) {
  const car = await data.getCar(ctx.org.corporate_id, carId)
  if (!car) return show(ctx, 'Автомобиль не найден.', menuBtn(new InlineKeyboard()))
  const { rows, total } = await data.getHistory(car.id, offset, HIST_PAGE)
  const blocks = rows.map(h => {
    const oil = h.oil_brand
      ? `🛢 ${esc(h.oil_brand)}${h.oil_viscosity ? ' ' + esc(h.oil_viscosity) : ''}${h.oil_liters ? ` · ${R.fmtLiters(h.oil_liters)} л` : ''}` +
        (Number(h.oil_cost) ? ` · ${fmtInt(h.oil_cost)} ₸` : '')
      : null
    // The master now picks materials freely from the warehouse (used_items) instead of a fixed
    // oil/filter template; older records only have the legacy oil_filter/air_filter/... columns.
    const items = Array.isArray(h.used_items) ? h.used_items : []
    const filterNames = items.length
      ? items.filter(it => it.category === 'filter').map(it => it.name)
      : [h.oil_filter, h.air_filter, h.cabin_filter, h.fuel_filter].filter(Boolean)
    const otherNames = items.filter(it => it.category && it.category !== 'oil' && it.category !== 'filter').map(it => it.name)
    return [
      `🗓 <b>${fmtDate(h.date)}</b> · ${fmtInt(h.mileage)} км`,
      (h.services || []).length ? `🔧 ${esc(h.services.join(', '))}` : null,
      oil,
      filterNames.length ? `🔩 Фильтры: ${esc(filterNames.join(', '))}` : null,
      otherNames.length ? `🧴 Материалы: ${esc(otherNames.join(', '))}` : null,
      h.master_name ? `👨‍🔧 ${esc(h.master_name)}` : null,
      h.master_notes ? `💬 <i>${esc(h.master_notes)}</i>` : null,
      `💰 <b>${fmtInt(h.total)} ₸</b>`,
    ].filter(Boolean).join('\n')
  })
  const kb = new InlineKeyboard()
  if (offset > 0) kb.text('◀️ Новее', `hist|${car.id}|${Math.max(0, offset - HIST_PAGE)}`)
  if (offset + HIST_PAGE < total) kb.text('Старее ▶️', `hist|${car.id}|${offset + HIST_PAGE}`)
  if (offset > 0 || offset + HIST_PAGE < total) kb.row()
  kb.text('◀️ К автомобилю', `car|${car.id}`)
  menuBtn(kb)
  await show(ctx,
    head('📖', 'История обслуживания', `${carName(car)} · <code>${esc(car.license_plate)}</code>`) + '\n' +
    (blocks.length ? blocks.join(`\n${SOFT}\n`) : 'Записей об обслуживании пока нет.'), kb)
}

// ─── Add car ─────────────────────────────────────────────────────────────────
const ADD_STEPS = ['make', 'model', 'year', 'plate', 'fuel', 'volume', 'mileage']
const ADD_PROMPT = {
  make: 'Введите <b>марку</b>',
  model: 'Введите <b>модель</b>',
  year: 'Введите <b>год выпуска</b>',
  plate: 'Введите <b>госномер</b>',
  fuel: 'Выберите <b>тип топлива</b>',
  volume: 'Введите <b>объём двигателя</b> в литрах',
  mileage: 'Введите <b>текущий пробег</b> в километрах',
}
const ADD_EXAMPLE = {
  make: 'Toyota', model: 'Camry', year: '2023', plate: '123ABC01', volume: '2.5', mileage: '125000',
}

async function startAddCar(ctx, returnTo) {
  const s = sess(ctx)
  s.mode = 'addcar'
  s.draft = { kind: 'addcar', step: 'make', returnTo: returnTo || 'cars', car: {} }
  await askAddStep(ctx, 'make')
}

/** One screen per step; what's been entered so far stays on top, so nothing has to stay in the chat. */
async function askAddStep(ctx, step, warn) {
  const s = sess(ctx)
  s.draft.step = step
  const c = s.draft.car
  const entered = [
    (c.make || c.model) && `${esc(c.make || '')} ${esc(c.model || '')}`.trim(),
    c.year && `${c.year} г.`,
    c.plate && `<code>${esc(c.plate)}</code>`,
    c.engineType && `${c.engineVolume ? c.engineVolume.toFixed(1) + ' ' : ''}${esc(c.engineType)}`,
  ].filter(Boolean)
  const kb = new InlineKeyboard()
  if (step === 'fuel') {
    FUELS.forEach((f, i) => { kb.text(f, `af|fuel|${i}`); if (i % 3 === 2) kb.row() })
    kb.row()
  }
  kb.text('❌ Отмена', 'car|addcancel')
  const n = ADD_STEPS.indexOf(step) + 1
  await show(ctx,
    head('➕', 'Новый автомобиль', `Шаг ${n} из ${ADD_STEPS.length}`) +
    (entered.length ? entered.map(e => `✔️ ${e}`).join('\n') + '\n\n' : '\n') +
    (warn ? `⚠️ ${warn}\n\n` : '') +
    ADD_PROMPT[step] + (ADD_EXAMPLE[step] ? `\n<i>например,</i> <code>${ADD_EXAMPLE[step]}</code>` : ''),
    kb, { placeholder: ADD_EXAMPLE[step] ? `${ADD_PROMPT[step].replace(/<[^>]+>/g, '')}, например ${ADD_EXAMPLE[step]}`.slice(0, 64) : 'Выберите на кнопках ниже' })
}

function nextAddStep(draft) {
  const i = ADD_STEPS.indexOf(draft.step)
  let next = ADD_STEPS[i + 1]
  if (next === 'volume' && draft.car.engineType === 'Электро') { draft.car.engineVolume = 0; next = 'mileage' }
  return next
}

async function advanceAddCar(ctx) {
  const next = nextAddStep(sess(ctx).draft)
  if (next) return askAddStep(ctx, next)
  return confirmAddCar(ctx)
}

async function confirmAddCar(ctx) {
  const d = sess(ctx).draft
  d.step = 'confirm'
  const c = d.car
  const kb = new InlineKeyboard().text('✅ Сохранить', 'af|save').text('🔁 Заново', 'af|redo').text('❌ Отмена', 'car|addcancel')
  await show(ctx,
    head('📝', 'Проверьте данные') + '\n' +
    `🚗 <b>${esc(c.make)} ${esc(c.model)}</b> · ${c.year} г.\n` +
    `🔖 <code>${esc(c.plate)}</code>\n` +
    `⚙️ ${c.engineVolume ? c.engineVolume.toFixed(1) + ' · ' : ''}${esc(c.engineType)}\n` +
    `🛣 ${fmtInt(c.mileage)} км\n\nСохранить автомобиль?`, kb)
}

async function handleAddCarText(ctx, text) {
  const d = sess(ctx).draft
  const c = d.car
  const v = text.trim()
  const bad = (msg) => askAddStep(ctx, d.step, msg)
  switch (d.step) {
    case 'make': if (!v || v.length > 50) return bad('Введите марку (до 50 символов).'); c.make = v; break
    case 'model': if (!v || v.length > 50) return bad('Введите модель (до 50 символов).'); c.model = v; break
    case 'year': {
      const y = parseInt(v, 10)
      if (!/^\d{4}$/.test(v) || y < 1970 || y > data.nowLocal().getUTCFullYear() + 1) return bad('Введите год из 4 цифр, например 2023.')
      c.year = y; break
    }
    case 'plate': {
      const plate = v.toUpperCase().replace(/\s+/g, '')
      if (plate.length < 5 || plate.length > 12) return bad('Госномер должен содержать от 5 до 12 символов.')
      const dup = await data.findCarByPlate(plate)
      if (dup) {
        sess(ctx).mode = null; sess(ctx).draft = null
        const own = dup.corporate_id === ctx.org.corporate_id
        // a deleted (archived) car keeps its plate reserved. The client can't restore it itself — it can ask the administrator
        if (dup.archived_at && own) {
          const carLine = `🚗 <b>${carName(dup)}</b> · <code>${esc(dup.license_plate)}</code>`
          if (await data.getPendingDeleteRequest(dup.id)) {
            return show(ctx, head('⏳', 'Запрос уже отправлен') + `\n${carLine}\n\nАдминистратор Garage 56 рассматривает восстановление. Мы пришлём уведомление, когда решение будет принято.`,
              new InlineKeyboard().text('🏠 Меню', 'menu'))
          }
          return show(ctx,
            head('♻️', 'Автомобиль уже был в вашем парке') + `\n${carLine}\n\n` +
            'Он был удалён из автопарка, но вся история обслуживания сохранена. Добавить ещё один автомобиль с этим номером нельзя — ' +
            'можно отправить администратору Garage 56 запрос на восстановление.',
            new InlineKeyboard().text('📨 Запросить восстановление', `car|restore|${dup.id}`).text('❌ Отмена', 'car|addcancel'))
        }
        return show(ctx, own ? 'ℹ️ Автомобиль с таким госномером уже есть в вашем автопарке.'
          : '⚠️ Автомобиль с таким госномером уже зарегистрирован в системе. Обратитесь в Garage 56.',
        menuBtn(new InlineKeyboard().text('🚗 Мои автомобили', 'cl|cars|0')))
      }
      c.plate = plate; break
    }
    case 'volume': {
      const n = parseNum(v)
      if (!isFinite(n) || n < 0.5 || n > 9) return bad('Введите объём в литрах, например 2.5.')
      c.engineVolume = Math.round(n * 10) / 10; break
    }
    case 'mileage': {
      const n = Math.round(parseNum(v))
      if (!isFinite(n) || n < 0 || n > 3000000) return bad('Введите пробег числом, например 125000.')
      c.mileage = n; break
    }
    default: return
  }
  await advanceAddCar(ctx)
}

async function saveCar(ctx) {
  const d = sess(ctx).draft
  if (d?.kind !== 'addcar' || d.step !== 'confirm') return show(ctx, '⌛ Сессия устарела. Начните добавление заново.', menuBtn(new InlineKeyboard()))
  try {
    const id = await data.createCar(ctx.org.corporate_id, d.car)
    const back = d.returnTo, c = d.car
    sess(ctx).mode = null; sess(ctx).draft = null
    const kb = new InlineKeyboard().text('🚗 Открыть карточку', `car|${id}`)
    if (back === 'book') kb.text('📅 Записать на ТО', `bk|car|${id}`)
    kb.row().text('➕ Добавить ещё', `car|add|${back}`)
    menuBtn(kb)
    await show(ctx, head('✅', 'Автомобиль добавлен') + `\n🚗 <b>${esc(c.make)} ${esc(c.model)}</b>\n🔖 <code>${esc(c.plate)}</code>`, kb)
  } catch (e) {
    if (e.code === '23505') return show(ctx, '⚠️ Автомобиль с таким госномером уже есть в системе.', menuBtn(new InlineKeyboard()))
    throw e
  }
}

// ─── Booking ─────────────────────────────────────────────────────────────────
function slotsForDate(st, date) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay()
  if (dow === 0 && st.sunClosed) return []
  const [open, close] = dow === 0 ? st.sun : dow === 6 ? st.sat : st.weekday
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const out = []
  for (let m = toMin(open); m < toMin(close); m += st.slotMin) out.push(`${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`)
  return out
}
const futureOnly = (times, date) => date === data.todayISO() ? times.filter(t => t > data.nowHM()) : times

/** Only days that can actually be booked: open, not in the past, still with a free slot. */
async function availableDates(st) {
  const today = data.todayISO()
  const booked = await data.getBookedCounts(today, addDays(today, st.daysAhead))
  const out = []
  for (let i = 0; i <= st.daysAhead; i++) {
    const date = addDays(today, i)
    const all = slotsForDate(st, date)
    if (futureOnly(all, date).length && (booked[date] || 0) < all.length) out.push(date)
  }
  return out
}

function bookDraft(ctx) {
  const d = sess(ctx).draft
  return d?.kind === 'book' ? d : null
}
async function expired(ctx) {
  await show(ctx, '⌛ Сессия записи устарела. Начните заново.', menuBtn(new InlineKeyboard().text('📅 Записаться', 'book')))
}

/** Common header of every booking step: what has been chosen so far. */
function bookHead(d, step, title) {
  return head('📅', 'Запись на обслуживание', `Шаг ${step} из 4 · ${title}`) +
    `🚗 ${esc(d.carLabel)}\n` + (d.date ? `🗓 ${weekday(d.date)}, ${longDate(d.date)}${d.time ? ` · ${d.time}` : ''}\n` : '') + '\n'
}

async function showBookStart(ctx) {
  const s = sess(ctx); s.mode = null; s.draft = null; s.q = ''
  const { total } = await data.listCars(ctx.org.corporate_id, { limit: 1 })
  if (!total) {
    return show(ctx, head('📅', 'Записаться') + '\nСначала добавьте автомобиль в автопарк.',
      menuBtn(new InlineKeyboard().text('➕ Добавить автомобиль', 'car|add|book')))
  }
  // "Мои записи" is already one tap away from the home menu — no need to repeat it here
  const kb = menuBtn(new InlineKeyboard().text('🚗 Выбрать автомобиль', 'cl|book|0'))
  await show(ctx, head('📅', 'Записаться', 'Быстрая запись за 4 шага') +
    '\n1️⃣ Дата\n2️⃣ Время\n3️⃣ Услуги\n4️⃣ Пожелания\n\nМы подтвердим запись и пришлём уведомление.', kb)
}

const DATES_PER_PAGE = 15

async function showCalendar(ctx, page = 0, warn) {
  const d = bookDraft(ctx); if (!d) return expired(ctx)
  const st = await data.getSettings()
  const dates = await availableDates(st)
  d.calPage = page
  const back = new InlineKeyboard()
  if (!dates.length) {
    back.text('◀️ Назад', 'cl|book|0')
    return show(ctx, bookHead(d, 1, 'дата') + '😔 <b>Свободных дат сейчас нет.</b>\n' +
      `Позвоните нам${st.phone ? `: <b>${esc(st.phone)}</b>` : ''} — подберём время вручную.`, back, { home: true })
  }
  const pages = Math.ceil(dates.length / DATES_PER_PAGE)
  page = Math.min(Math.max(0, page), pages - 1); d.calPage = page
  // the dates themselves are inline buttons in the chat; the bottom panel keeps only the actions
  const list = new InlineKeyboard()
  dates.slice(page * DATES_PER_PAGE, (page + 1) * DATES_PER_PAGE).forEach((date, i, arr) => {
    list.text(`${weekday(date)} ${date.slice(8)}.${date.slice(5, 7)}`, `bk|day|${date}`)
    if (i % 3 === 2 && i < arr.length - 1) list.row()
  })
  if (pages > 1) {
    list.row()
    list.text('◀️ Ранее', page > 0 ? `bk|cal|${page - 1}` : 'noop')
    list.text(`${page + 1} / ${pages}`, 'noop')
    list.text('Позже ▶️', page < pages - 1 ? `bk|cal|${page + 1}` : 'noop')
  }
  const kb = new InlineKeyboard().text('◀️ Назад', 'cl|book|0')
  await show(ctx, (warn ? `⚠️ ${warn}\n\n` : '') + bookHead(d, 1, 'дата') +
    `🗓 <b>Выберите дату</b>\n<i>Показаны только свободные дни на ближайшие ${st.daysAhead} дн.</i>`, kb,
  { inline: { text: '👇 <b>Свободные даты</b>', kb: list }, home: true })
}

async function showTimes(ctx, date, warn) {
  const d = bookDraft(ctx); if (!d) return expired(ctx)
  const st = await data.getSettings()
  const taken = await data.getTakenTimes(date)
  const free = futureOnly(slotsForDate(st, date), date).filter(t => !taken.includes(t))
  if (!free.length) return showCalendar(ctx, d.calPage || 0, 'На эту дату свободного времени нет — выберите другую.')
  d.date = date; d.time = null
  const list = new InlineKeyboard()
  free.forEach((t, i) => { list.text(t, `bk|time|${t}`); if (i % 4 === 3 && i < free.length - 1) list.row() })
  const kb = new InlineKeyboard().text('◀️ Назад', `bk|cal|${d.calPage || 0}`)
  await show(ctx, (warn ? `⚠️ ${warn}\n\n` : '') + bookHead(d, 2, 'время') +
    '🕐 <b>Выберите время</b>\n<i>Только свободные окошки</i>', kb,
  { inline: { text: `👇 <b>Свободное время · ${longDate(date)}</b>`, kb: list }, home: true })
}

async function showServices(ctx, warn) {
  const d = bookDraft(ctx); if (!d) return expired(ctx)
  if (!d.svcList) d.svcList = (await data.listServices()).map(s => s.name)
  if (!d.svcList.length) return askComment(ctx) // no services configured: describe the work in the comment
  // the checklist itself is inline buttons in the chat (like dates/times); the bottom panel keeps only the
  // actions, and its two buttons never change label/action while ticking boxes — only the checklist above
  // does — so `show` can edit both messages in place instead of resending the whole screen on every tap
  // (a static bottom keyboard was the point: it keeps the tick/untick flicker-free).
  const list = new InlineKeyboard()
  d.svcList.forEach((name, i) => list.text(`${d.services.includes(i) ? '✅' : '⬜️'} ${name}`, `bk|svc|${i}`).row())
  const kb = new InlineKeyboard().text('🕐 Другое время', `bk|day|${d.date}`).text('Далее ➡️', 'bk|svcdone')
  const count = d.services.length ? ` · выбрано ${d.services.length}` : ''
  await show(ctx, (warn ? `⚠️ ${warn}\n\n` : '') +
    bookHead(d, 3, 'услуги') + '🔧 <b>Выберите необходимые работы</b>\n<i>Отметьте нужные — можно несколько</i>', kb,
  { inline: { text: `👇 <b>Работы</b>${count}`, kb: list } })
}

async function askComment(ctx) {
  const d = bookDraft(ctx); if (!d) return expired(ctx)
  sess(ctx).mode = 'comment'
  // the picked services vanished from this screen — show them so the client sees what they're leaving a note about
  const names = (d.services || []).map(i => d.svcList[i]).filter(Boolean)
  const svcLine = names.length ? `🔧 <b>Услуги:</b> ${names.map(esc).join(', ')}\n\n` : ''
  await show(ctx, bookHead(d, 4, 'пожелания') + svcLine + '💬 <b>Есть дополнительные пожелания?</b>\nНапишите сообщение или нажмите «Пропустить».',
    new InlineKeyboard().text('◀️ Назад', 'bk|svcback').text('⏭ Пропустить', 'bk|skipcomment'),
    { placeholder: 'Ваш комментарий для мастера…' })
}

async function showBookConfirm(ctx) {
  const d = bookDraft(ctx); if (!d) return expired(ctx)
  sess(ctx).mode = null
  const car = await data.getCar(ctx.org.corporate_id, d.carId)
  if (!car) return expired(ctx)
  const names = d.services.map(i => d.svcList[i])
  const kb = new InlineKeyboard().text('✅ Подтвердить запись', 'bk|ok').row().text('❌ Отмена', 'menu')
  const lines = [
    head('📋', 'Проверьте запись'),
    `🚗 <b>${carName(car)}</b> · <code>${esc(car.license_plate)}</code>`,
    `🛣 Пробег: ${fmtInt(car.mileage)} км`,
    `🗓 <b>${weekday(d.date)}, ${longDate(d.date)} · ${d.time}</b>`,
    '',
    '🔧 <b>Услуги</b>',
    names.length ? names.map(n => `▫️ ${esc(n)}`).join('\n') : '—',
    d.comment ? `\n💬 <i>«${esc(d.comment)}»</i>` : null,
  ].filter(l => l !== null)
  await show(ctx, lines.join('\n'), kb)
}

async function confirmBooking(ctx) {
  const d = bookDraft(ctx); if (!d || !d.time) return expired(ctx)
  const car = await data.getCar(ctx.org.corporate_id, d.carId)
  if (!car) return expired(ctx)
  const names = d.services.map(i => d.svcList[i])
  const who = ctx.org.user_name || data.dbSafe(ctx.from.first_name).trim() || 'сотрудник'
  const comment = [`Запись из Telegram (${who}).`, d.comment].filter(Boolean).join('\n')
  const id = await data.createAppointment(ctx.org, car, {
    date: d.date, time: d.time, services: names, comment,
  })
  if (!id) {
    return showTimes(ctx, d.date, 'Это время только что заняли. Выберите другое.')
  }
  sess(ctx).draft = null; sess(ctx).mode = null
  sendPush({ kind: 'booking', source: 'telegram', bookingId: String(id), title: 'Новая запись от таксопарка',
    body: `${ctx.org.company_name} · ${car.make} ${car.model} · ${car.license_plate} · ${d.date.split('-').reverse().slice(0, 2).join('.')} в ${d.time}`,
    url: '/crm/appointments' })
  await show(ctx,
    head('✅', 'Запись создана') + '\n' +
    `🚗 <b>${carName(car)}</b> · <code>${esc(car.license_plate)}</code>\n` +
    `🗓 <b>${weekday(d.date)}, ${longDate(d.date)} · ${d.time}</b>\n\n` +
    'Мы ждём вас в Garage 56 🙌\n<i>Как только администратор подтвердит запись — пришлём уведомление.</i>',
    menuBtn(new InlineKeyboard().text('📋 Мои записи', 'apts')))
}

const APT_PAGE = 4   // same page size as the service history, so a screen never turns into a wall of text

// Three tabs, one status meaning per tab — no need to branch on every status inside a card any more:
//  'pending' — awaiting the admin's confirmation (the only stage the client can still cancel)
//  'active'  — confirmed; either waiting for its scheduled time or already in work
//  'done'    — completed
const APT_TABS = {
  pending: { label: '⏳ В ожидании', tag: 'в ожидании', empty: 'Нет заявок, ожидающих подтверждения.' },
  active: { label: '🔧 Активные', tag: 'активные', empty: 'Нет подтверждённых записей.' },
  done: { label: '🏁 Завершённые', tag: 'завершённые', empty: 'Завершённых работ пока нет.' },
}

/** Status as the client should see it — one line, in the tone that fits the tab it's already filtered into. */
function statusLine(a) {
  const master = a.master_name ? `👨‍🔧 Мастер: <b>${esc(a.master_name)}</b>` : null
  switch (a.status) {
    case 'pending':
      return '⏳ <b>Ожидает подтверждения</b>\n<i>Garage 56 свяжется и подтвердит запись</i>'
    case 'confirmed':
      return '🕐 <b>Подтверждена</b> · ждёт своего времени' + (master ? `\n${master}` : '')
    case 'in_progress':
      return '🔧 <b>Автомобиль в работе</b>' + (master ? `\n${master}` : '\n<i>мастер назначается</i>')
    case 'completed':
      return '✅ <b>Выполнено</b>' + (master ? ` · ${master}` : '') + (Number(a.total) ? `\n💰 Стоимость: <b>${fmtInt(a.total)} ₸</b>` : '')
    default: return a.status
  }
}

async function showAppointments(ctx, tab = 'pending', offset = 0) {
  if (!APT_TABS[tab]) tab = 'pending'
  const { rows, total } = await data.listAppointments(ctx.org.corporate_id, tab, offset, APT_PAGE)
  // the bottom panel is small on phones — keep it to just the tab switch + Меню, a fixed height that
  // never grows with the number of appointments
  const kb = new InlineKeyboard()
  for (const [key, t] of Object.entries(APT_TABS)) kb.text(`${tab === key ? '• ' : ''}${t.label}`, `apts|${key}|0`)
  menuBtn(kb)
  const today = data.todayISO()
  // cards + their "Отменить"/pager buttons live in the chat as an inline list (like the car list,
  // dates, times…) instead of the bottom panel, so the panel doesn't balloon with one row per record
  const list = new InlineKeyboard()
  const cards = rows.map(a => {
    if (tab === 'pending') {
      list.text(`❌ Отменить ${fmtDate(a.date).slice(0, 5)} ${hm(a.time)} · ${a.license_plate}`, `apt|cancel|${a.id}`).row()
    } else if (tab === 'active' && !a.cancel_requested) {
      // once confirmed, the client can only ASK to cancel — an administrator decides in the CRM
      list.text(`🗑 Запросить отмену ${fmtDate(a.date).slice(0, 5)} ${hm(a.time)} · ${a.license_plate}`, `apt|cancelreq|${a.id}`).row()
    }
    // flag today/tomorrow on upcoming work so it doesn't get lost among later dates
    const dayTag = tab !== 'done'
      ? (a.date === today ? ' · 🔥 <b>Сегодня</b>' : a.date === addDays(today, 1) ? ' · Завтра' : '')
      : ''
    const when = tab === 'done' ? fmtDate(a.date) : `${fmtDate(a.date)} · ${hm(a.time)}`
    const cancelNote = tab === 'active' && a.cancel_requested ? '\n🕐 <i>Запрос на отмену отправлен — ждём решения администратора</i>' : ''
    // each order in its own quote block — reads as a distinct card instead of a wall of plain text
    return `<blockquote>🗓 <b>${when}</b>${dayTag}\n🚗 <b>${esc(a.car_make)} ${esc(a.car_model)}</b> · <code>${esc(a.license_plate)}</code>\n` +
      `🔧 ${esc((a.services || []).join(', ') || '—')}\n${statusLine(a)}${cancelNote}</blockquote>`
  })
  const pages = Math.max(1, Math.ceil(total / APT_PAGE))
  if (pages > 1) {
    // "Назад"/"Вперёд" always present (just inert at the ends) — otherwise the page label
    // jumps left/right depending on which buttons happen to exist on that page
    const page = Math.floor(offset / APT_PAGE)
    list.text('◀️ Назад', page > 0 ? `apts|${tab}|${offset - APT_PAGE}` : 'noop')
    list.text(`Страница ${page + 1} из ${pages}`, 'noop')
    list.text('Вперёд ▶️', page < pages - 1 ? `apts|${tab}|${offset + APT_PAGE}` : 'noop')
  }
  await show(ctx,
    head('📋', 'Мои записи', `${APT_TABS[tab].tag} · ${total}`) + (cards.length ? '' : `\n${APT_TABS[tab].empty}`),
    kb, { inline: cards.length ? { text: cards.join('\n'), kb: list } : null })
}

// ─── Cancellation requests for confirmed/in-work orders (the client can only ask; an administrator
// decides in the CRM) ──────────────────────────────────────────────────────────────────────────
async function askCancelRequestReason(ctx, appointmentId, warn) {
  const a = await data.getAppointment(appointmentId)
  if (!a || a.corporate_id !== ctx.org.corporate_id) return show(ctx, 'Запись не найдена.', menuBtn(new InlineKeyboard()))
  if (!['confirmed', 'in_progress'].includes(a.status)) return showAppointments(ctx, 'active')
  if (await data.getPendingCancelRequest(a.id)) return showAppointments(ctx, 'active')
  const s = sess(ctx)
  s.mode = 'cancelreqreason'
  s.draft = { kind: 'cancelreq', appointmentId: a.id, reason: '' }
  await show(ctx,
    (warn ? `⚠️ ${warn}\n\n` : '') +
    head('🗑', 'Запрос на отмену записи', `${esc(a.car_make)} ${esc(a.car_model)} · ${esc(a.license_plate)}`) +
    `\n🗓 <b>${weekday(a.date)}, ${longDate(a.date)} · ${hm(a.time)}</b>\n\n` +
    'Запись уже подтверждена — отменить её может только администратор Garage 56, вы отправляете ему запрос.\n\n' +
    '✍️ <b>Обязательно укажите причину отмены</b> — без неё запрос не отправить.',
    new InlineKeyboard().text('◀️ Назад', 'apts|active|0'),
    { placeholder: 'Причина отмены', home: true })
}

async function confirmCancelRequest(ctx) {
  const d = sess(ctx).draft
  if (d?.kind !== 'cancelreq') return show(ctx, '⌛ Сессия устарела.', menuBtn(new InlineKeyboard()))
  const a = await data.getAppointment(d.appointmentId)
  if (!a) return show(ctx, 'Запись не найдена.', menuBtn(new InlineKeyboard()))
  sess(ctx).mode = null
  await show(ctx,
    head('🗑', 'Отправить запрос на отмену?') + '\n' +
    `🚗 <b>${esc(a.car_make)} ${esc(a.car_model)}</b> · <code>${esc(a.license_plate)}</code>\n` +
    `🗓 <b>${weekday(a.date)}, ${longDate(a.date)} · ${hm(a.time)}</b>\n` +
    `📝 Причина: <i>«${esc(d.reason)}»</i>\n\n` +
    '<i>До решения администратора запись остаётся в силе. Мы пришлём уведомление, когда запрос будет рассмотрен.</i>',
    new InlineKeyboard().text('❌ Отмена', 'apts|active|0').text('✅ Отправить запрос', 'acr|send'),
    { home: true })
}

async function sendCancelRequest(ctx) {
  const d = sess(ctx).draft
  if (d?.kind !== 'cancelreq') return show(ctx, '⌛ Сессия устарела.', menuBtn(new InlineKeyboard()))
  const a = await data.getAppointment(d.appointmentId)
  if (!a) return show(ctx, 'Запись не найдена.', menuBtn(new InlineKeyboard()))
  const id = await data.createCancelRequest(ctx.org, a, d.reason, ctx.from.id)
  sess(ctx).draft = null; sess(ctx).mode = null
  if (!id) return showAppointments(ctx, 'active')   // somebody from the same company has already asked
  sendPush({ kind: 'appointment_cancel_request', requestId: String(id), title: 'Запрос на отмену записи',
    body: `${ctx.org.company_name} · ${a.car_make} ${a.car_model} · ${a.license_plate} · ${fmtDate(a.date)} в ${hm(a.time)} · ${d.reason}`,
    url: '/crm/appointments' })
  await show(ctx,
    head('📨', 'Запрос на отмену отправлен') + '\n' +
    `🚗 <b>${esc(a.car_make)} ${esc(a.car_model)}</b> · <code>${esc(a.license_plate)}</code>\n\n` +
    'Администратор Garage 56 рассмотрит запрос. Запись остаётся в силе до решения — мы пришлём уведомление.',
    menuBtn(new InlineKeyboard().text('📋 К записям', 'apts|active|0')))
}

// ─── Reports ─────────────────────────────────────────────────────────────────
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

/** Reports are picked month by month (months are inline buttons in the chat), with a year switcher. */
async function showReportMenu(ctx, year) {
  sess(ctx).mode = null
  const today = data.todayISO()
  const curYear = +today.slice(0, 4), curMonth = +today.slice(5, 7)
  year = Math.min(Math.max(parseInt(year, 10) || curYear, 2000), curYear)
  const { minYear, months } = await data.getReportOverview(ctx.org.corporate_id, year)
  const firstYear = Math.min(minYear || curYear, curYear)

  const list = new InlineKeyboard()
  const last = year === curYear ? curMonth : 12
  for (let m = 1; m <= last; m++) {
    list.text(months[m] ? `${MONTHS[m - 1]} · ${months[m]}` : MONTHS[m - 1], `rep|m|${year}-${pad2(m)}`)
    if (m % 3 === 0 && m < last) list.row()
  }
  // the year switcher keeps 3 buttons at both ends of the range too, so "Весь ... год" doesn't
  // jump sideways depending on whether a neighbouring year happens to exist
  list.row()
  list.text(year > firstYear ? `◀️ ${year - 1}` : '·', year > firstYear ? `rep|y|${year - 1}` : 'noop')
  list.text(`📦 Весь ${year} год`, `rep|yr|${year}`)
  list.text(year < curYear ? `${year + 1} ▶️` : '·', year < curYear ? `rep|y|${year + 1}` : 'noop')

  const kb = menuBtn(new InlineKeyboard().text('🗓 Свой период', 'rep|custom'))
  const total = Object.values(months).reduce((s, n) => s + n, 0)
  await show(ctx, head('📊', 'Отчёты', 'Для бухгалтерии: Excel и PDF') +
    `\nОтчёт по фактически выполненным работам: автомобили, масло и фильтры, мастера и стоимость.\n\n` +
    `📆 <b>${year} год</b> · выполнено заказов: <b>${total}</b>\n<i>Цифра рядом с месяцем — число выполненных заказов.</i>`,
  kb, { inline: { text: '👇 <b>Выберите месяц</b>', kb: list } })
}

async function showReport(ctx, from, to) {
  const rows = await data.getReportRows(ctx.org.corporate_id, from, to)
  const rep = R.buildReport(rows, { from, to, company: ctx.org.company_name })
  const kb = new InlineKeyboard()
  if (rows.length) kb.text('📄 Скачать PDF', `rep|pdf|${from}|${to}`).text('📊 Скачать Excel', `rep|xls|${from}|${to}`).row()
  kb.text('📆 Другой месяц', `rep|y|${from.slice(0, 4)}`)
  menuBtn(kb)
  await show(ctx, rows.length ? R.summaryText(rep, esc)
    : head('📊', 'Отчёт', R.periodTitle(from, to)) + '\nЗа этот период выполненных работ нет.', kb)
}

async function sendReportFile(ctx, kind, from, to) {
  const wait = await ctx.reply('⏳ Формирую файл…')
  try {
    const rows = await data.getReportRows(ctx.org.corporate_id, from, to)
    const rep = R.buildReport(rows, { from, to, company: ctx.org.company_name })
    const buf = kind === 'pdf' ? await R.buildPdf(rep) : await R.buildExcel(rep)
    const name = `Garage56_report_${R.periodFileTag(from, to)}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`
    await ctx.replyWithDocument(new InputFile(buf, name), { caption: `📊 Отчёт: ${R.periodTitle(from, to)} · ${ctx.org.company_name}` })
  } finally {
    await ctx.api.deleteMessage(ctx.chat.id, wait.message_id).catch(() => {})
  }
}

const parseRuDate = (t) => {
  const m = String(t).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const iso = `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`
  const d = new Date(iso + 'T00:00:00Z')
  return isNaN(d) || d.toISOString().slice(0, 10) !== iso ? null : iso
}
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── Router ──────────────────────────────────────────────────────────────────
async function route(ctx, cb) {
  const [a, b, c, d] = cb.split('|')
  const corp = ctx.org?.corporate_id

  if (a === 'noop') return
  if (a === 'auth') {
    if (b === 'login') return askCode(ctx)
    if (b === 'back') return showWelcome(ctx)
    if (b === 'contact') return showContact(ctx)
    return showAccessInfo(ctx)
  }
  if (!ctx.org) return showWelcome(ctx)

  switch (a) {
    case 'menu': return showMenu(ctx)
    case 'org': return showOrg(ctx)

    // cars
    case 'cl': sess(ctx).mode = null; return showCarList(ctx, b, parseInt(c, 10) || 0)
    case 'find': sess(ctx).mode = `search:${b}`
      return show(ctx, head('🔍', 'Поиск автомобиля') + '\nВведите госномер, марку или модель.',
        menuBtn(new InlineKeyboard().text('◀️ Назад', `cl|${b}|0`)), { placeholder: 'Госномер, марка или модель' })
    case 'clr': sess(ctx).q = ''; return showCarList(ctx, b, 0)
    case 'car':
      if (b === 'add') return startAddCar(ctx, c)
      if (b === 'addcancel') { sess(ctx).mode = null; sess(ctx).draft = null; return showMenu(ctx) }
      if (b === 'restore') return sendRestoreRequest(ctx, parseInt(c, 10))
      return showCar(ctx, parseInt(b, 10))
    case 'hist': return showHistory(ctx, parseInt(b, 10), parseInt(c, 10) || 0)
    case 'cdr':
      if (b === 'ask') return askDeleteReason(ctx, parseInt(c, 10))
      if (b === 'noreason') { const dr = sess(ctx).draft; if (dr?.kind === 'delreq') dr.reason = ''; return confirmDeleteRequest(ctx) }
      if (b === 'send') return sendDeleteRequest(ctx)
      return
    case 'af': {
      const dr = sess(ctx).draft
      if (dr?.kind !== 'addcar') return show(ctx, 'Сессия устарела.', menuBtn(new InlineKeyboard()))
      if (b === 'fuel' && dr.step === 'fuel' && FUELS[+c]) { dr.car.engineType = FUELS[+c]; return advanceAddCar(ctx) }
      if (b === 'redo') return startAddCar(ctx, dr.returnTo)
      if (b === 'save') return saveCar(ctx)
      return
    }

    // booking
    case 'book': return showBookStart(ctx)
    case 'apts': return showAppointments(ctx, b, parseInt(c, 10) || 0)
    case 'apt':
      if (b === 'cancel') {
        return show(ctx, head('❓', 'Отменить запись?') + '\nЗапись будет отменена, время освободится.',
          new InlineKeyboard().text('🔙 Нет', 'apts').text('✅ Да, отменить', `apt|cancelok|${c}`),
          { home: true })
      }
      if (b === 'cancelok') {
        const r = await data.cancelAppointment(corp, parseInt(c, 10))
        if (r) {
          sendPush({ kind: 'booking_cancelled', source: 'telegram', bookingId: String(r.id), title: 'Таксопарк отменил запись',
            body: `${ctx.org.company_name} · ${r.car_make} ${r.car_model} · ${r.license_plate} · ${fmtDate(r.date).slice(0, 5)} в ${hm(r.time)}`,
            url: '/crm/appointments' })
        }
        return showAppointments(ctx)
      }
      if (b === 'cancelreq') return askCancelRequestReason(ctx, parseInt(c, 10))
      return
    case 'acr':
      if (b === 'send') return sendCancelRequest(ctx)
      return
    case 'bk': {
      if (b === 'car') {
        const car = await data.getCar(corp, parseInt(c, 10))
        if (!car) return show(ctx, 'Автомобиль не найден.', menuBtn(new InlineKeyboard()))
        const s = sess(ctx)
        s.mode = null
        s.draft = { kind: 'book', carId: car.id, carLabel: `${car.make} ${car.model} · ${car.license_plate}`, services: [] }
        return showCalendar(ctx, 0)
      }
      const dr = bookDraft(ctx)
      if (!dr) return expired(ctx)
      if (b === 'cal') return showCalendar(ctx, parseInt(c, 10) || 0)
      if (b === 'day') { if (!ISO_RE.test(c)) return; return showTimes(ctx, c) }
      if (b === 'time') {
        if (!/^\d{2}:\d{2}$/.test(c)) return
        dr.time = c
        return showServices(ctx)
      }
      if (b === 'svc') {
        const i = parseInt(c, 10)
        if (!(i >= 0 && i < (dr.svcList || []).length)) return
        dr.services = dr.services.includes(i) ? dr.services.filter(x => x !== i) : [...dr.services, i]
        return showServices(ctx)
      }
      if (b === 'svcdone') {
        if (!dr.services.length) return showServices(ctx, 'Выберите хотя бы одну работу')
        dr.services.sort((x, y) => x - y)
        return askComment(ctx)
      }
      if (b === 'svcback') return showServices(ctx)
      if (b === 'skipcomment') return showBookConfirm(ctx)
      if (b === 'ok') return confirmBooking(ctx)
      return
    }

    // reports
    case 'rep': {
      if (!b) return showReportMenu(ctx)
      const today = data.todayISO()
      const [y, m] = today.split('-').map(Number)
      if (b === 'cur') return showReport(ctx, `${y}-${pad2(m)}-01`, today.slice(0, 7) + '-' + pad2(lastDayOfMonth(y, m)))
      if (b === 'prev') {
        const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1
        return showReport(ctx, `${py}-${pad2(pm)}-01`, `${py}-${pad2(pm)}-${pad2(lastDayOfMonth(py, pm))}`)
      }
      if (b === 'y') return showReportMenu(ctx, c)
      if (b === 'm' && /^\d{4}-(0[1-9]|1[0-2])$/.test(c)) {
        const [yy, mm] = c.split('-').map(Number)
        return showReport(ctx, `${c}-01`, `${c}-${pad2(lastDayOfMonth(yy, mm))}`)
      }
      if (b === 'yr' && /^\d{4}$/.test(c)) return showReport(ctx, `${c}-01-01`, `${c}-12-31`)
      if (b === 'custom') return askPeriod(ctx)
      if (b === 'last7' || b === 'last30') {
        const today = data.todayISO()
        return showReport(ctx, addDays(today, b === 'last7' ? -6 : -29), today)
      }
      if (b === 'q' || b === 'qprev') {
        const today = data.todayISO()
        const [yy, mm] = today.split('-').map(Number)
        let qy = yy, qi = Math.floor((mm - 1) / 3)
        if (b === 'qprev') { qi--; if (qi < 0) { qi = 3; qy-- } }
        const startM = qi * 3 + 1, endM = qi * 3 + 3
        const to = b === 'q' ? today : `${qy}-${pad2(endM)}-${pad2(lastDayOfMonth(qy, endM))}`
        return showReport(ctx, `${qy}-${pad2(startM)}-01`, to)
      }
      if ((b === 'pdf' || b === 'xls') && ISO_RE.test(c) && ISO_RE.test(d)) return sendReportFile(ctx, b, c, d)
      return
    }
  }
}

async function showOrg(ctx) {
  const [o, st] = await Promise.all([data.getOrgInfo(ctx.org.corporate_id), data.getSettings()])
  return show(ctx,
    head('🏢', esc(o.company_name), 'Данные таксопарка') + '\n' +
    `🚗 Автомобилей: <b>${o.cars_count}</b>\n\n` +
    `👤 Контактное лицо: <b>${esc(o.contact_person || '—')}</b>\n` +
    `📞 Телефон: <b>${esc(o.phone || '—')}</b>` +
    (o.contract ? `\n📄 Договор: <b>${esc(o.contract)}</b>` : '') +
    `\n\n<i>Изменение реквизитов — через администратора Garage 56${st.phone ? ': ' + esc(st.phone) : ''}.</i>`,
    menuBtn(new InlineKeyboard()))
}

async function handleText(ctx) {
  const s = sess(ctx)
  const raw = ctx.message.text.trim()   // matched before sanitizing: button labels contain emoji
  const text = data.dbSafe(raw).trim()  // everything typed here may end up in the DB

  // A tap on a bottom-keyboard button arrives as a plain text message. The current screen's buttons win;
  // the section names also work from an older keyboard still shown after a bot restart.
  const action = s.keys.get(raw) ?? (ctx.org ? NAV_ACTION[raw] : undefined)
  if (action) {
    if (NAV_ACTION[raw] === action) { s.mode = null; s.draft = null; s.q = '' }   // a section button abandons any unfinished step
    return route(ctx, action)
  }

  if (!ctx.org) {
    if (s.mode === 'code' || normalizeCode(text)) return tryLink(ctx, text)
    return showWelcome(ctx)
  }

  if (s.mode === 'addcar' && s.draft?.kind === 'addcar') return handleAddCarText(ctx, text)

  if (s.mode?.startsWith('search:')) {
    const mode = s.mode.slice(7)
    s.q = text.slice(0, 50); s.mode = null
    return showCarList(ctx, mode, 0)
  }

  if (s.mode === 'delreason' && s.draft?.kind === 'delreq') {
    s.draft.reason = text.slice(0, 300)
    return confirmDeleteRequest(ctx)
  }

  // reason is mandatory here (unlike a car delete request) — an empty message is rejected
  if (s.mode === 'cancelreqreason' && s.draft?.kind === 'cancelreq') {
    const reason = text.slice(0, 300)
    if (!reason) return askCancelRequestReason(ctx, s.draft.appointmentId, 'Укажите причину — без неё запрос не отправить.')
    s.draft.reason = reason
    return confirmCancelRequest(ctx)
  }

  if (s.mode === 'comment' && bookDraft(ctx)) {
    bookDraft(ctx).comment = text.slice(0, 500)
    return showBookConfirm(ctx)
  }

  if (s.mode === 'period') {
    const [f, t] = text.split(/\s*[-–—]\s*/).map(parseRuDate)
    if (!f || !t || f > t) return askPeriod(ctx, 'Не понял период. Пример: 01.08.2026-31.08.2026')
    if ((Date.parse(t) - Date.parse(f)) / 864e5 > 366) return askPeriod(ctx, 'Максимальный период — 1 год.')
    s.mode = null
    return showReport(ctx, f, t)
  }

  // Free text with no active step: most likely the dialog was interrupted (e.g. the bot restarted)
  return showMenu(ctx, 'ℹ️ Не понял сообщение — диалог мог прерваться. Выберите действие:')
}

async function askPeriod(ctx, warn) {
  sess(ctx).mode = 'period'
  const kb = new InlineKeyboard()
    .text('📅 Последние 7 дней', 'rep|last7').text('📅 Последние 30 дней', 'rep|last30').row()
    .text('📦 Этот квартал', 'rep|q').text('📦 Прошлый квартал', 'rep|qprev').row()
    .text('◀️ Назад', 'rep')
  await show(ctx, (warn ? `⚠️ ${warn}\n\n` : '') + head('🗓', 'Свой период') +
    '\n<b>Быстрый выбор</b> — кнопкой ниже, или введите свои даты через дефис:\n<code>01.08.2026-31.08.2026</code>',
    kb, { placeholder: '01.08.2026-31.08.2026', home: true })
}

// ─── Notifications (called by the API when the CRM changes an appointment) ───
// In the CRM the "Подтвердить" button moves an order straight to "in work", so that is the
// moment the client is told the booking is confirmed AND which master has the car.
const masterLine = (a) => a.master_name ? `\n👨‍🔧 Мастер: <b>${esc(a.master_name)}</b>` : '\n👨‍🔧 Мастер: назначается'
const apptLine = (a) => `🚗 <b>${esc(a.car_make)} ${esc(a.car_model)}</b> · <code>${esc(a.license_plate)}</code>\n🗓 <b>${fmtDate(a.date)} · ${hm(a.time)}</b>`
const NOTIFY_TEXT = {
  created: (a) => head('📋', 'Запись создана') + `\n${apptLine(a)}`,
  confirmed: (a) => head('✅', 'Запись подтверждена') + `\n${apptLine(a)}${a.master_name ? masterLine(a) : ''}\n\nМы ожидаем вас 🙌`,
  in_progress: (a) => head('✅', 'Запись подтверждена', 'Автомобиль в работе') + `\n${apptLine(a)}\n🔧 Статус: <b>В работе</b>${masterLine(a)}`,
  rescheduled: (a) => head('🔄', 'Запись перенесена') + `\n${apptLine(a)}`,
  cancelled: (a) => head('❌', 'Запись отменена') + `\n${apptLine(a)}`,
  completed: (a) => head('🏁', 'Обслуживание завершено') + `\n${apptLine(a)}${a.master_name ? masterLine(a) : ''}` +
    (Number(a.total) ? `\n💰 Стоимость: <b>${fmtInt(a.total)} ₸</b>` : '') + '\n\n📖 Техническая книжка обновлена.',
}

/** Tell the company how its car-deletion request was decided in the CRM. */
async function notifyCarDeletion(requestId) {
  try {
    if (!bot) return
    const r = await data.getDeleteRequest(requestId)
    if (!r || r.status === 'pending') return
    const car = `🚗 <b>${esc(r.car_label)}</b> · <code>${esc(r.license_plate)}</code>`
    const comment = r.admin_comment ? `\n💬 <i>«${esc(r.admin_comment)}»</i>` : ''
    let text
    if (r.kind === 'restore') {
      text = r.status === 'approved'
        ? head('♻️', 'Автомобиль восстановлен') + `\n${car}\n\nАдминистратор Garage 56 вернул автомобиль в ваш автопарк. История обслуживания на месте.`
        : head('↩️', 'Запрос на восстановление отклонён') + `\n${car}\n\nАвтомобиль остаётся в архиве.${comment}`
    } else {
      text = r.status === 'approved'
        ? head('🗑', 'Автомобиль удалён') + `\n${car}\n\nАдминистратор Garage 56 убрал автомобиль из вашего автопарка. ` +
          'История обслуживания и отчёты сохранены. Если он понадобится снова, добавьте его по госномеру и отправьте запрос на восстановление.'
        : head('↩️', 'Запрос на удаление отклонён') + `\n${car}\n\nАвтомобиль остаётся в вашем автопарке.${comment}`
    }
    await sendToOrg(r.corporate_id, text)
  } catch (e) { console.error('[bot] car deletion notice error:', e.message) }
}

/** Tell the company the outcome of its "please cancel this confirmed order" request. */
async function notifyCancelRequestDecision(requestId) {
  try {
    if (!bot) return
    const r = await data.getCancelRequest(requestId)
    if (!r || r.status === 'pending') return
    const car = `🚗 <b>${esc(r.car_label)}</b> · <code>${esc(r.license_plate)}</code>`
    const when = `🗓 ${fmtDate(r.appt_date)} · ${hm(r.appt_time)}`
    const comment = r.admin_comment ? `\n💬 <i>«${esc(r.admin_comment)}»</i>` : ''
    const text = r.status === 'approved'
      ? head('❌', 'Запись отменена') + `\n${car}\n${when}\n\nЗапрос на отмену одобрен администратором Garage 56.`
      : head('↩️', 'Запрос на отмену отклонён') + `\n${car}\n${when}\n\nЗапись остаётся в силе.${comment}`
    await sendToOrg(r.corporate_id, text)
  } catch (e) { console.error('[bot] cancel request notice error:', e.message) }
}

async function sendToOrg(corporateId, text) {
  if (!bot) return
  const ids = await data.getTelegramIdsForCorp(corporateId)
  await Promise.allSettled(ids.map(id => bot.api.sendMessage(id, text, { parse_mode: 'HTML' })
    .catch(e => console.error(`[bot] send to ${id} failed:`, e.description || e.message))))
}

async function notifyAppointment(appointmentId, event) {
  try {
    if (!bot || !NOTIFY_TEXT[event]) return
    const a = await data.getAppointment(appointmentId)
    if (!a?.corporate_id) return
    await sendToOrg(a.corporate_id, NOTIFY_TEXT[event](a))
  } catch (e) { console.error('[bot] notify error:', e.message) }
}

/** Reminders: once per appointment, when it starts within the next 24 hours. */
async function sendReminders() {
  try {
    const now = data.nowLocal().toISOString().slice(0, 16).replace('T', ' ')
    const { rows } = await pool.query(`
      UPDATE appointments a SET tg_reminded = true
      WHERE a.tg_reminded = false AND a.status IN ('pending','confirmed','in_progress')
        AND ${data.CORP_OF('a')} IS NOT NULL
        AND (a.date + a.time) BETWEEN $1::timestamp AND $1::timestamp + INTERVAL '24 hours'
      RETURNING a.id, ${data.CORP_OF('a')} AS corporate_id, a.date, a.time, a.car_make, a.car_model, a.license_plate`, [now])
    for (const a of rows) {
      const when = a.date === data.todayISO() ? 'сегодня' : 'завтра'
      await sendToOrg(a.corporate_id,
        head('⏰', 'Напоминание о записи') + `\nЖдём вас <b>${when} в ${hm(a.time)}</b>\n` +
        `🚗 <b>${esc(a.car_make)} ${esc(a.car_model)}</b> · <code>${esc(a.license_plate)}</code>\n\nGarage 56 🙌`)
    }
  } catch (e) { console.error('[bot] reminders error:', e.message) }
}

// ─── Start ───────────────────────────────────────────────────────────────────
function buildBot(token) {
  const b = new Bot(token)

  b.use(async (ctx, next) => {
    if (ctx.chat?.type !== 'private' || !ctx.from) return
    ctx.org = await data.getOrgByTelegramId(ctx.from.id)
    // Keep the chat clean: what the user typed/tapped is removed (the screen message shows the result)
    if (ctx.message) ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {})
    return next()
  })

  b.command(['start', 'menu'], async (ctx) => {
    const fresh = { fresh: true } // new screen at the bottom, the old one is removed
    const payload = ctx.match?.trim()
    if (!ctx.org && payload && normalizeCode(payload)) return tryLink(ctx, payload, fresh)
    return ctx.org ? showMenu(ctx, null, fresh) : showWelcome(ctx, fresh)
  })

  b.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {})
    await route(ctx, ctx.callbackQuery.data)
  })

  b.on('message:text', handleText)

  b.catch(async (err) => {
    console.error('[bot] error:', err.error?.message || err.message)
    try {
      await show(err.ctx, '⚠️ Что-то пошло не так. Попробуйте ещё раз.', new InlineKeyboard().text('🏠 Меню', 'menu'))
    } catch { /* ignore */ }
  })

  return b
}

async function startBot(opts = {}) {
  // Schema is applied even without a token: the CRM endpoints for connect codes rely on it
  await pool.query(fs.readFileSync(path.join(__dirname, '../../database/migrations/004_telegram_bot.sql'), 'utf8'))

  const encoding = await data.initEncoding()

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('ℹ️  Telegram bot disabled (TELEGRAM_BOT_TOKEN is not set)'); return }
  if (opts.sendPush) sendPush = opts.sendPush

  bot = buildBot(token)

  await bot.api.setMyCommands([{ command: 'menu', description: 'Главное меню' }])
  const me = await bot.api.getMe()
  botUsername = me.username
  bot.start({ onStart: () => console.log(`🤖 Telegram bot started: @${me.username} (DB encoding: ${encoding})`) })
    .catch(e => console.error('[bot] stopped:', e.message))

  setInterval(sendReminders, 10 * 60 * 1000).unref()
  setTimeout(sendReminders, 15 * 1000).unref()
}

module.exports = {
  startBot, notifyAppointment, notifyCarDeletion, notifyCancelRequestDecision, buildBot,
  attachBot: (b) => { bot = b }, // lets tests plug in a bot with a fake transport
  attachPush: (fn) => { sendPush = fn }, // …and capture what the bot tells the CRM staff
  getBotUsername: () => botUsername,
}
