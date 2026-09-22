// Data layer for the Telegram bot.
// The bot has no storage of its own: everything is read from / written to the same
// PostgreSQL tables the CRM and the website use. Every query is scoped by corporate_id.
const { pool } = require('../db')
const { normalizePlate } = require('../normalize')

// ─── Text safety ─────────────────────────────────────────────────────────────
// The production DB may be WIN1251, which cannot store emoji or Kazakh letters:
// such an INSERT fails outright. Strip what the DB can't hold (skipped on UTF8 databases).
const WIN1251_CHARS = (() => {
  const set = new Set()
  try {
    const dec = new TextDecoder('windows-1251')
    for (let i = 128; i < 256; i++) { const ch = dec.decode(Uint8Array.of(i)); if (ch !== '�') set.add(ch) }
  } catch { /* no ICU: keep only ASCII below */ }
  return set
})()
let dbIsUtf8 = false

async function initEncoding() {
  const { rows: [r] } = await pool.query('SHOW server_encoding')
  dbIsUtf8 = /^utf-?8$/i.test(r.server_encoding)
  return r.server_encoding
}

// Kazakh letters missing from WIN1251 → closest Cyrillic letter (keeps names readable instead of dropping them)
const KZ_FALLBACK = {
  'ә': 'а', 'Ә': 'А', 'ғ': 'г', 'Ғ': 'Г', 'қ': 'к', 'Қ': 'К', 'ң': 'н', 'Ң': 'Н',
  'ө': 'о', 'Ө': 'О', 'ұ': 'у', 'Ұ': 'У', 'ү': 'у', 'Ү': 'У', 'һ': 'х', 'Һ': 'Х', '₸': 'тг',
}

function dbSafe(value) {
  const text = String(value ?? '')
  return [...(dbIsUtf8 ? text : text.replace(/[әӘғҒқҚңҢөӨұҰүҮһҺ₸]/g, ch => KZ_FALLBACK[ch]))]
    .filter(ch => {
      const c = ch.codePointAt(0)
      if (c === 0 || (c < 32 && c !== 10 && c !== 9)) return false
      return dbIsUtf8 || c < 128 || WIN1251_CHARS.has(ch)
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ') // a stripped emoji must not leave double spaces behind
}

// ─── Time (the site works in GMT+5) ──────────────────────────────────────────
const TZ_OFFSET_MS = 5 * 3600 * 1000
const nowLocal = () => new Date(Date.now() + TZ_OFFSET_MS)
const todayISO = () => nowLocal().toISOString().slice(0, 10)
const nowHM = () => nowLocal().toISOString().slice(11, 16)

// ─── Settings & services ─────────────────────────────────────────────────────
async function getSettings() {
  const { rows } = await pool.query(
    `SELECT key, value FROM settings WHERE key = ANY($1)`,
    [['name', 'address', 'phone', 'weekday_open', 'weekday_close', 'sat_open', 'sat_close',
      'sun_open', 'sun_close', 'sun_closed', 'slot_duration', 'booking_days_ahead']]
  )
  const s = {}
  rows.forEach(r => { s[r.key] = r.value })
  return {
    name: s.name || 'Garage 56',
    address: s.address || '',
    phone: s.phone || '',
    weekday: [s.weekday_open || '09:00', s.weekday_close || '18:00'],
    sat: [s.sat_open || '09:00', s.sat_close || '17:00'],
    sun: [s.sun_open || '09:00', s.sun_close || '17:00'],
    sunClosed: s.sun_closed === 'true',
    slotMin: parseInt(s.slot_duration || '60', 10) || 60,
    daysAhead: parseInt(s.booking_days_ahead || '14', 10) || 14,
  }
}

async function listServices() {
  const { rows } = await pool.query(
    'SELECT id, name FROM services WHERE is_active = true ORDER BY sort_order, id'
  )
  return rows
}

// ─── Linking Telegram ↔ organisation ─────────────────────────────────────────
const ORG_SELECT = `
  SELECT tu.id AS tg_row_id, tu.corporate_id, tu.role, tu.name AS user_name,
         c.company_name, c.contact_person, c.phone, c.contract
  FROM telegram_users tu
  JOIN corporate_clients c ON c.id = tu.corporate_id
  WHERE tu.telegram_id = $1 AND tu.is_active = true`

async function getOrgByTelegramId(telegramId) {
  const { rows } = await pool.query(ORG_SELECT, [telegramId])
  return rows[0] || null
}

/** One-time code: consumed atomically so two people can't use the same code. */
async function linkByCode(tgUser, code) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [corp] } = await client.query(
      `UPDATE corporate_clients
          SET connect_code = NULL, connect_code_expires_at = NULL
        WHERE connect_code = $1 AND connect_code_expires_at > NOW()
        RETURNING id`,
      [code]
    )
    if (!corp) { await client.query('ROLLBACK'); return null }
    const name = dbSafe([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')).trim() || null
    await client.query(
      `INSERT INTO telegram_users (telegram_id, corporate_id, name, username)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (telegram_id) DO UPDATE
         SET corporate_id = EXCLUDED.corporate_id, name = EXCLUDED.name,
             username = EXCLUDED.username, is_active = true`,
      [tgUser.id, corp.id, name, tgUser.username || null]
    )
    await client.query('COMMIT')
    return corp.id
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

async function getTelegramIdsForCorp(corporateId) {
  const { rows } = await pool.query(
    'SELECT telegram_id FROM telegram_users WHERE corporate_id = $1 AND is_active = true',
    [corporateId]
  )
  return rows.map(r => r.telegram_id)
}

// ─── Which appointments belong to an organisation ────────────────────────────
// An appointment counts as the organisation's if it is tagged with it OR it is for one of its cars
// (orders typed into the CRM for a fleet car often carry no corporate_id).
const OWN = (a, p) => `(${a}.corporate_id = ${p} OR ${a}.car_id IN (SELECT id FROM cars WHERE corporate_id = ${p}))`
const CORP_OF = (a) => `COALESCE(${a}.corporate_id, (SELECT c.corporate_id FROM cars c WHERE c.id = ${a}.car_id))`
const ACTIVE_STATUSES = `('pending','confirmed','in_progress')`

// ─── Main menu stats ─────────────────────────────────────────────────────────
async function getOrgStats(corporateId) {
  const monthStart = todayISO().slice(0, 8) + '01'
  const { rows: [r] } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM cars WHERE corporate_id = $1 AND archived_at IS NULL) AS cars,
      (SELECT COUNT(*) FROM appointments a
        WHERE ${OWN('a', '$1')} AND a.status = 'completed' AND a.date >= $2::date) AS done_month,
      (SELECT COUNT(*) FROM appointments a
        WHERE ${OWN('a', '$1')} AND a.status IN ${ACTIVE_STATUSES}
          AND (a.date >= $3::date OR a.status = 'in_progress')) AS active
  `, [corporateId, monthStart, todayISO()])
  return { cars: +r.cars, doneMonth: +r.done_month, active: +r.active }
}

// ─── Cars ────────────────────────────────────────────────────────────────────
// A "deleted" car is archived, never removed: it disappears from every list here, but its orders and
// history stay in the database (the OWN predicate above deliberately does NOT filter archived cars,
// so reports keep counting their work).
async function listCars(corporateId, { q = '', offset = 0, limit = 8 } = {}) {
  const vals = [corporateId]
  let where = 'corporate_id = $1 AND archived_at IS NULL'
  const term = q.trim()
  if (term) {
    vals.push(`%${term}%`, `%${normalizePlate(term) || term}%`)
    where += ` AND (make ILIKE $2 OR model ILIKE $2
                    OR license_plate ILIKE $2 OR plate_normalized ILIKE $3)`
  }
  const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM cars WHERE ${where}`, vals)
  const { rows } = await pool.query(
    `SELECT id, make, model, year, license_plate FROM cars WHERE ${where}
      ORDER BY make, model, license_plate LIMIT ${+limit} OFFSET ${+offset}`,
    vals
  )
  return { rows, total: +count }
}

async function getCar(corporateId, carId) {
  const { rows } = await pool.query(
    'SELECT * FROM cars WHERE id = $1 AND corporate_id = $2 AND archived_at IS NULL',
    [carId, corporateId]
  )
  return rows[0] || null
}

/** Finds a car by plate among ALL cars, archived ones included (`archived_at` tells them apart). */
async function findCarByPlate(plate) {
  const norm = normalizePlate(plate)
  if (!norm) return null
  const { rows } = await pool.query(
    'SELECT id, corporate_id, make, model, license_plate, archived_at FROM cars WHERE plate_normalized = $1', [norm]
  )
  return rows[0] || null
}

// NOTE: there is deliberately no "restore" for the bot: a client can only ASK for it (createDeleteRequest kind 'restore'),
// the administrator restores the car in the CRM.

async function createCar(corporateId, c) {
  const { rows } = await pool.query(
    `INSERT INTO cars (corporate_id, make, model, year, engine_type, engine_volume,
                       license_plate, plate_normalized, mileage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [corporateId, c.make, c.model, c.year, c.engineType, c.engineVolume,
     c.plate, normalizePlate(c.plate), c.mileage]
  )
  return rows[0].id
}

// ─── Car deletion requests (the client can only ask; an administrator decides in the CRM) ─────
async function getPendingDeleteRequest(carId) {
  const { rows } = await pool.query(
    `SELECT id, created_at FROM car_delete_requests WHERE car_id = $1 AND status = 'pending'`, [carId])
  return rows[0] || null
}

/**
 * A request to the administrator about a car: kind 'delete' (remove from the fleet) or 'restore' (bring back an
 * archived car). Returns the new request id, or null if this car already has an open request.
 */
async function createDeleteRequest(org, car, reason, telegramId, kind = 'delete') {
  const { rows } = await pool.query(`
    INSERT INTO car_delete_requests (corporate_id, car_id, car_label, license_plate, reason, requested_by, telegram_id, kind)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (car_id) WHERE status = 'pending' AND car_id IS NOT NULL DO NOTHING
    RETURNING id`,
  [org.corporate_id, car.id, `${car.make} ${car.model}`.trim(), car.license_plate, reason || null, org.user_name || null, telegramId, kind])
  return rows[0]?.id ?? null
}

async function getDeleteRequest(id) {
  const { rows } = await pool.query('SELECT * FROM car_delete_requests WHERE id = $1', [id])
  return rows[0] || null
}

// ─── Tech book ───────────────────────────────────────────────────────────────
async function getCarBookSummary(carId) {
  const { rows: [r] } = await pool.query(`
    SELECT COUNT(*) AS visits,
           COUNT(*) FILTER (WHERE oil_brand IS NOT NULL
                              OR EXISTS (SELECT 1 FROM UNNEST(services) s WHERE s ILIKE '%масл%')) AS oil_changes,
           MAX(date) AS last_date
    FROM service_history WHERE car_id = $1`, [carId])
  let last = null
  if (r.last_date) {
    const { rows: [l] } = await pool.query(
      'SELECT mileage FROM service_history WHERE car_id = $1 ORDER BY date DESC, id DESC LIMIT 1', [carId])
    last = { date: r.last_date, mileage: l?.mileage }
  }
  return { visits: +r.visits, oilChanges: +r.oil_changes, last }
}

async function getHistory(carId, offset = 0, limit = 4) {
  const { rows: [{ count }] } = await pool.query(
    'SELECT COUNT(*) FROM service_history WHERE car_id = $1', [carId])
  const { rows } = await pool.query(
    `SELECT * FROM service_history WHERE car_id = $1
      ORDER BY date DESC, id DESC LIMIT ${+limit} OFFSET ${+offset}`, [carId])
  return { rows, total: +count }
}

// ─── Booking ─────────────────────────────────────────────────────────────────
async function getTakenTimes(date) {
  const { rows } = await pool.query(
    `SELECT time FROM appointments WHERE date = $1 AND status <> 'cancelled'`, [date])
  return rows.map(r => String(r.time).slice(0, 5))
}

/** Number of booked appointments per day in [from, to] — to grey out full days. */
async function getBookedCounts(from, to) {
  const { rows } = await pool.query(
    `SELECT date, COUNT(DISTINCT time) AS cnt FROM appointments
      WHERE date BETWEEN $1 AND $2 AND status <> 'cancelled' GROUP BY date`, [from, to])
  const m = {}
  rows.forEach(r => { m[r.date] = +r.cnt })
  return m
}

/** Inserts the appointment unless the slot got taken meanwhile. Returns id or null. */
async function createAppointment(org, car, a) {
  const { rows } = await pool.query(`
    INSERT INTO appointments
      (date,time,client_name,client_phone,car_make,car_model,car_year,license_plate,
       engine_type,engine_volume,mileage,vin,services,oil_preference,comment,status,
       corporate_id,car_id,source)
    SELECT $1::date,$2::time,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',$16,$17,'telegram'
    WHERE NOT EXISTS (
      SELECT 1 FROM appointments WHERE date = $1::date AND time = $2::time AND status <> 'cancelled')
    RETURNING id`,
    [a.date, a.time, org.company_name, org.phone, car.make, car.model, car.year,
     car.license_plate, car.engine_type, car.engine_volume, car.mileage, car.vin,
     a.services, a.oilPreference || '', a.comment || null, org.corporate_id, car.id]
  )
  return rows[0]?.id ?? null
}

/**
 * tab 'active': waiting / confirmed / in work (in-work orders stay visible even if their date has passed)
 * tab 'done':   completed, newest first
 */
async function listAppointments(corporateId, tab, offset = 0, limit = 5) {
  const cond = tab === 'done'
    ? `a.status = 'completed'`
    : `a.status IN ${ACTIVE_STATUSES} AND (a.date >= $2::date OR a.status = 'in_progress')`
  const order = tab === 'done' ? 'a.date DESC, a.time DESC, a.id DESC' : 'a.date, a.time, a.id'
  const vals = tab === 'done' ? [corporateId] : [corporateId, todayISO()]
  const where = `${OWN('a', '$1')} AND ${cond}`
  const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM appointments a WHERE ${where}`, vals)
  const { rows } = await pool.query(`
    SELECT a.id, a.date, a.time, a.car_make, a.car_model, a.license_plate, a.services, a.status, a.total,
           e.name AS master_name
    FROM appointments a LEFT JOIN employees e ON e.id = a.master_id
    WHERE ${where} ORDER BY ${order} LIMIT ${+limit} OFFSET ${+offset}`, vals)
  return { rows, total: +count }
}

async function cancelAppointment(corporateId, id) {
  const { rows } = await pool.query(`
    UPDATE appointments a SET status = 'cancelled', cancel_reason = 'Отменено клиентом через Telegram'
    WHERE a.id = $2 AND ${OWN('a', '$1')} AND a.status IN ('pending','confirmed')
    RETURNING a.id, a.date, a.time, a.car_make, a.car_model, a.license_plate`, [corporateId, id])
  return rows[0] || null
}

async function getAppointment(id) {
  const { rows } = await pool.query(`
    SELECT a.id, a.date, a.time, a.car_make, a.car_model, a.license_plate, a.status, a.total,
           ${CORP_OF('a')} AS corporate_id, e.name AS master_name
    FROM appointments a LEFT JOIN employees e ON e.id = a.master_id
    WHERE a.id = $1`, [id])
  return rows[0] || null
}

// ─── Reports ─────────────────────────────────────────────────────────────────
async function getReportRows(corporateId, from, to) {
  const { rows } = await pool.query(`
    SELECT a.id, a.date, a.time, a.license_plate, a.car_make, a.car_model, a.mileage,
           a.services, a.oil_brand, a.oil_viscosity, a.oil_liters, a.oil_filter,
           a.air_filter, a.cabin_filter, a.service_notes, a.total, a.oil_cost, a.car_id,
           a.used_items, e.name AS master_name
    FROM appointments a LEFT JOIN employees e ON e.id = a.master_id
    WHERE a.status = 'completed'
      AND a.date BETWEEN $2::date AND $3::date
      AND ${OWN('a', '$1')}
    ORDER BY a.date, a.time, a.id`, [corporateId, from, to])
  return rows
}

/** For the month picker: first year with completed work, and how many orders each month of `year` has. */
async function getReportOverview(corporateId, year) {
  const { rows: [first] } = await pool.query(
    `SELECT MIN(EXTRACT(YEAR FROM a.date))::int AS min_year
       FROM appointments a WHERE a.status = 'completed' AND ${OWN('a', '$1')}`, [corporateId])
  const { rows } = await pool.query(`
    SELECT EXTRACT(MONTH FROM a.date)::int AS m, COUNT(*)::int AS n
    FROM appointments a
    WHERE a.status = 'completed' AND ${OWN('a', '$1')} AND a.date BETWEEN $2::date AND $3::date
    GROUP BY 1`, [corporateId, `${year}-01-01`, `${year}-12-31`])
  const months = {}
  rows.forEach(r => { months[r.m] = r.n })
  return { minYear: first?.min_year || null, months }
}

async function getOrgInfo(corporateId) {
  const { rows: [c] } = await pool.query(`
    SELECT c.*, (SELECT COUNT(*) FROM cars WHERE corporate_id = c.id AND archived_at IS NULL) AS cars_count
    FROM corporate_clients c WHERE c.id = $1`, [corporateId])
  return c
}

module.exports = {
  dbSafe, initEncoding,
  todayISO, nowHM, nowLocal,
  getSettings, listServices,
  getOrgByTelegramId, linkByCode, getTelegramIdsForCorp,
  getOrgStats,
  listCars, getCar, findCarByPlate, createCar,
  getCarBookSummary, getHistory,
  getPendingDeleteRequest, createDeleteRequest, getDeleteRequest,
  getTakenTimes, getBookedCounts, createAppointment, listAppointments, cancelAppointment, getAppointment,
  CORP_OF,
  getReportRows, getReportOverview, getOrgInfo,
}
