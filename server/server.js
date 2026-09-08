require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const AdmZip = require('adm-zip')
const webpush = require('web-push')
const { pool } = require('./db')
const { normalizePhone, normalizePlate } = require('./normalize')

// ─── Web Push setup ─────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@garage56.kz',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}
pool.query(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(console.error)

async function sendPushToAll(title, body, url) {
  if (!process.env.VAPID_PUBLIC_KEY) return
  try {
    const { rows } = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions')
    const payload = JSON.stringify({ title, body, url })
    await Promise.allSettled(rows.map(row =>
      webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload
      ).catch(async err => {
        // Remove expired/invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [row.endpoint])
        }
      })
    ))
  } catch (e) { console.error('push error:', e) }
}

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set')
  process.exit(1)
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })
const bookLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
}, express.static(path.join(__dirname, 'uploads')))

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images allowed'))
  },
})

const zipUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => cb(null, `import-${Date.now()}.zip`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.zip') ||
        file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed') cb(null, true)
    else cb(new Error('Only ZIP files allowed'))
  },
})

// ─── Auth middleware ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Недействительный токен' })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDate = (d) => d instanceof Date ? d.toISOString().split('T')[0] : d || null
const toTime = (t) => t ? String(t).slice(0, 5) : ''

function mapAppointment(row) {
  const apt = {
    id: String(row.id),
    date: toDate(row.date),
    time: toTime(row.time),
    clientName: row.client_name,
    clientPhone: row.client_phone,
    carMake: row.car_make,
    carModel: row.car_model,
    carYear: row.car_year,
    licensePlate: row.license_plate,
    engineType: row.engine_type || '',
    engineVolume: Number(row.engine_volume) || 0,
    mileage: row.mileage || 0,
    vin: row.vin || undefined,
    services: row.services || [],
    oilPreference: row.oil_preference || '',
    comment: row.comment || undefined,
    status: row.status,
    masterId: row.master_id ? String(row.master_id) : undefined,
    corporateId: row.corporate_id ? String(row.corporate_id) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    carId: row.car_id ? String(row.car_id) : undefined,
    total: row.total ? Number(row.total) : undefined,
    cancelReason: row.cancel_reason || undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
  if (row.oil_brand || row.oil_filter || row.air_filter || row.cabin_filter || row.service_notes) {
    apt.serviceRecord = {
      oil: row.oil_brand ? { brand: row.oil_brand, viscosity: row.oil_viscosity || '', liters: Number(row.oil_liters) || 0 } : undefined,
      oilFilter: row.oil_filter || undefined,
      airFilter: row.air_filter || undefined,
      cabinFilter: row.cabin_filter || undefined,
      notes: row.service_notes || undefined,
      total: Number(row.total) || 0,
    }
  }
  return apt
}

function mapCar(c) {
  return {
    id: String(c.id),
    clientId: c.client_id ? String(c.client_id) : undefined,
    corporateId: c.corporate_id ? String(c.corporate_id) : undefined,
    make: c.make,
    model: c.model,
    generation: c.generation || undefined,
    year: c.year,
    engineType: c.engine_type,
    engineVolume: Number(c.engine_volume),
    licensePlate: c.license_plate,
    vin: c.vin || undefined,
    mileage: c.mileage || 0,
    lastService: toDate(c.last_service),
    nextService: toDate(c.next_service),
  }
}

function mapHistory(h) {
  return {
    id: String(h.id),
    date: toDate(h.date),
    mileage: h.mileage,
    services: h.services || [],
    oil: h.oil_brand ? { brand: h.oil_brand, viscosity: h.oil_viscosity || '', liters: Number(h.oil_liters) || 0 } : undefined,
    filters: {
      oil: h.oil_filter || undefined,
      air: h.air_filter || undefined,
      cabin: h.cabin_filter || undefined,
      fuel: h.fuel_filter || undefined,
    },
    antifreeze: h.antifreeze || undefined,
    freon: h.freon || undefined,
    masterNotes: h.master_notes || undefined,
    total: Number(h.total) || 0,
    masterName: h.master_name || '',
  }
}

// ─── Client tracking helpers ──────────────────────────────────────────────────

/** Find existing client by normalized phone or create a new one. Returns client id. */
async function findOrCreateClient(name, phone) {
  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm) return null

  // Atomic upsert: ON CONFLICT handles concurrent requests with the same phone
  const ins = await pool.query(
    'INSERT INTO clients (name, phone, phone_normalized) VALUES ($1,$2,$3) ON CONFLICT (phone_normalized) WHERE phone_normalized IS NOT NULL DO NOTHING RETURNING id',
    [name, phone, phoneNorm]
  )
  if (ins.rows.length) return ins.rows[0].id

  // Row already existed — fetch it
  const { rows } = await pool.query('SELECT id FROM clients WHERE phone_normalized = $1', [phoneNorm])
  return rows[0]?.id ?? null
}

/** Find existing car by normalized plate or create one linked to client. Returns car id. */
async function findOrCreateCar(clientId, apt) {
  const plateNorm = normalizePlate(apt.licensePlate)
  if (!plateNorm) return null

  // Atomic upsert: handles concurrent requests with the same plate
  const ins = await pool.query(`
    INSERT INTO cars (client_id,make,model,year,engine_type,engine_volume,license_plate,vin,mileage,plate_normalized)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (plate_normalized) WHERE plate_normalized IS NOT NULL
    DO UPDATE SET
      client_id = COALESCE(cars.client_id, EXCLUDED.client_id),
      mileage   = GREATEST(cars.mileage, EXCLUDED.mileage)
    RETURNING id`,
    [clientId, apt.carMake, apt.carModel, apt.carYear,
     apt.engineType || 'Бензин', apt.engineVolume || 0,
     (apt.licensePlate || '').toUpperCase(), apt.vin || null,
     apt.mileage || 0, plateNorm]
  )
  return ins.rows[0].id
}

/** Recalculate visit stats for a client based on completed appointments. */
async function recalcClientStats(clientId) {
  if (!clientId) return
  const [{ rows: [stats] }, { rows: [setting] }] = await Promise.all([
    pool.query(`
      SELECT COUNT(*) AS cnt,
             MIN(date)                      AS first_visit,
             MAX(date)                      AS last_visit,
             COALESCE(SUM(total), 0)        AS total_spent
      FROM appointments WHERE client_id = $1 AND status = 'completed'
    `, [clientId]),
    pool.query(`SELECT value FROM settings WHERE key = 'regular_client_threshold'`),
  ])
  const threshold = parseInt(setting?.value || '3', 10)
  const cnt = Number(stats.cnt)
  await pool.query(`
    UPDATE clients SET
      visit_count    = $1,
      first_visit_at = $2,
      last_visit     = $3,
      total_spent    = $4,
      is_regular     = $5
    WHERE id = $6
  `, [cnt, stats.first_visit || null, stats.last_visit || null,
      Number(stats.total_spent), cnt >= threshold, clientId])
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body
    const { rows } = await pool.query(
      'SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]
    )
    const emp = rows[0]
    if (!emp || !(await bcrypt.compare(password, emp.password_hash))) {
      return res.status(401).json({ error: 'Неверный email или пароль' })
    }
    const token = jwt.sign({ id: emp.id, email: emp.email, role: emp.role }, JWT_SECRET, { expiresIn: '7d' })
    res.json({
      token,
      user: {
        id: String(emp.id),
        name: emp.name,
        email: emp.email,
        role: emp.role,
        masterId: emp.role === 'master' ? String(emp.id) : undefined,
        corporateId: emp.corporate_id ? String(emp.corporate_id) : undefined,
      }
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Employees ────────────────────────────────────────────────────────────────
app.get('/api/employees', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id,name,email,role,phone,specialization,corporate_id,is_active FROM employees ORDER BY id'
    )
    res.json(rows.map(e => ({
      id: String(e.id),
      name: e.name,
      email: e.email,
      role: e.role,
      phone: e.phone || '',
      specialization: e.specialization || '',
      corporateId: e.corporate_id ? String(e.corporate_id) : undefined,
      isActive: e.is_active,
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/employees', auth, async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Недостаточно прав' })
    const { name, email, password, role, phone, specialization } = req.body
    const assignedRole = role || 'master'
    const roleRank = { owner: 3, admin: 2, master: 1, corporate: 1 }
    if ((roleRank[assignedRole] ?? 0) > (roleRank[req.user.role] ?? 0))
      return res.status(403).json({ error: 'Нельзя назначить роль выше своей' })
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'INSERT INTO employees (name,email,password_hash,role,phone,specialization) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, email, hash, assignedRole, phone || null, specialization || null]
    )
    res.json({ id: String(rows[0].id) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/employees/:id', auth, async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Недостаточно прав' })
    const { name, email, role, phone, specialization, isActive, password } = req.body
    const roleRank = { owner: 3, admin: 2, master: 1, corporate: 1 }
    if (role && (roleRank[role] ?? 0) > (roleRank[req.user.role] ?? 0))
      return res.status(403).json({ error: 'Нельзя назначить роль выше своей' })
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await pool.query(
        'UPDATE employees SET name=$1,email=$2,role=$3,phone=$4,specialization=$5,is_active=$6,password_hash=$7 WHERE id=$8',
        [name, email, role, phone, specialization, isActive ?? true, hash, req.params.id]
      )
    } else {
      await pool.query(
        'UPDATE employees SET name=$1,email=$2,role=$3,phone=$4,specialization=$5,is_active=$6 WHERE id=$7',
        [name, email, role, phone, specialization, isActive ?? true, req.params.id]
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/employees/:id', auth, async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Недостаточно прав' })
    await pool.query('UPDATE employees SET is_active=false WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Appointments ─────────────────────────────────────────────────────────────
app.get('/api/appointments', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM appointments ORDER BY date DESC, time DESC')
    res.json(rows.map(mapAppointment))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/appointments', auth, async (req, res) => {
  try {
    const a = req.body
    const { rows } = await pool.query(`
      INSERT INTO appointments
        (date,time,client_name,client_phone,car_make,car_model,car_year,license_plate,
         engine_type,engine_volume,mileage,vin,services,oil_preference,comment,status,master_id,corporate_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [a.date, a.time, a.clientName, a.clientPhone, a.carMake, a.carModel, a.carYear,
       a.licensePlate, a.engineType, a.engineVolume, a.mileage, a.vin || null, a.services,
       a.oilPreference, a.comment || null, a.status || 'pending', a.masterId || null, a.corporateId || null]
    )
    const aptId = rows[0].id
    // Auto-link client and car (fire-and-forget, do not fail the request)
    findOrCreateClient(a.clientName, a.clientPhone).then(async clientId => {
      const carId = clientId ? await findOrCreateCar(clientId, a) : null
      if (clientId || carId) {
        await pool.query(
          'UPDATE appointments SET client_id=$1, car_id=$2 WHERE id=$3',
          [clientId, carId, aptId]
        )
      }
    }).catch(console.error)
    const svcLabel = Array.isArray(a.services) && a.services.length
      ? a.services.slice(0, 2).join(', ') + (a.services.length > 2 ? ` +${a.services.length - 2}` : '')
      : ''
    sendPushToAll(
      '📋 Новая запись',
      `${a.clientName} · ${a.date} ${a.time}${svcLabel ? ' · ' + svcLabel : ''}`,
      '/crm/appointments'
    )
    res.json({ id: String(aptId) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/appointments/:id', auth, async (req, res) => {
  try {
    const d = req.body
    const fields = []; const vals = []; let i = 1
    const add = (col, val) => { fields.push(`${col}=$${i++}`); vals.push(val) }
    if (d.status !== undefined) add('status', d.status)
    if (d.date !== undefined) add('date', d.date)
    if (d.time !== undefined) add('time', d.time)
    if (d.total !== undefined) add('total', d.total)
    if (d.cancelReason !== undefined) add('cancel_reason', d.cancelReason)
    if (d.masterId !== undefined) add('master_id', d.masterId)
    if (d.services !== undefined) add('services', d.services)
    if (d.serviceRecord) {
      const sr = d.serviceRecord
      if (sr.oil) { add('oil_brand', sr.oil.brand); add('oil_viscosity', sr.oil.viscosity); add('oil_liters', sr.oil.liters) }
      if (sr.oilFilter !== undefined) add('oil_filter', sr.oilFilter)
      if (sr.airFilter !== undefined) add('air_filter', sr.airFilter)
      if (sr.cabinFilter !== undefined) add('cabin_filter', sr.cabinFilter)
      if (sr.notes !== undefined) add('service_notes', sr.notes)
    }
    if (!fields.length) return res.json({ ok: true })
    vals.push(req.params.id)
    await pool.query(`UPDATE appointments SET ${fields.join(',')} WHERE id=$${i}`, vals)
    // Recalc client stats + write service history when appointment is completed
    if (d.status === 'completed') {
      let { rows: [apt] } = await pool.query(
        `SELECT client_id, car_id, client_name, client_phone, car_make, car_model, car_year,
                license_plate, engine_type, engine_volume, mileage, vin, date, services,
                oil_brand, oil_viscosity, oil_liters, oil_filter, air_filter, cabin_filter,
                service_notes, total, master_id
         FROM appointments WHERE id=$1`,
        [req.params.id]
      )
      if (apt?.client_id) {
        await recalcClientStats(apt.client_id).catch(console.error)
      } else if (apt?.client_name && apt?.client_phone) {
        try {
          const clientId = await findOrCreateClient(apt.client_name, apt.client_phone)
          if (clientId) {
            const aptData = {
              carMake: apt.car_make, carModel: apt.car_model, carYear: apt.car_year,
              licensePlate: apt.license_plate, engineType: apt.engine_type,
              engineVolume: apt.engine_volume, mileage: apt.mileage, vin: apt.vin,
            }
            const carId = await findOrCreateCar(clientId, aptData).catch(() => null)
            await pool.query('UPDATE appointments SET client_id=$1, car_id=$2 WHERE id=$3', [clientId, carId, req.params.id])
            await recalcClientStats(clientId)
            apt = { ...apt, client_id: clientId, car_id: carId }
          }
        } catch (e) { console.error('completion client link error:', e) }
      }
      // Write service history record when car is linked
      if (apt?.car_id) {
        try {
          const masterRow = apt.master_id
            ? (await pool.query('SELECT name FROM employees WHERE id=$1', [apt.master_id])).rows[0]
            : null
          await pool.query(`
            INSERT INTO service_history
              (car_id, date, mileage, services, oil_brand, oil_viscosity, oil_liters,
               oil_filter, air_filter, cabin_filter, master_notes, total, master_name)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `, [
            apt.car_id, apt.date, apt.mileage || 0, apt.services || [],
            apt.oil_brand || null, apt.oil_viscosity || null, apt.oil_liters || null,
            apt.oil_filter || null, apt.air_filter || null, apt.cabin_filter || null,
            apt.service_notes || null, apt.total || 0, masterRow?.name || null,
          ])
        } catch (e) { console.error('service_history insert error:', e) }
      }
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Clients ──────────────────────────────────────────────────────────────────

function mapClient(c) {
  return {
    id: String(c.id),
    name: c.name,
    phone: c.phone,
    email: c.email || undefined,
    visitCount: Number(c.visit_count) || 0,
    lastVisit: toDate(c.last_visit),
    firstVisit: toDate(c.first_visit_at),
    totalSpent: Number(c.total_spent) || 0,
    isRegular: Boolean(c.is_regular),
    notes: c.notes || undefined,
    createdAt: toDate(c.created_at),
  }
}

// GET /api/clients?search=&isRegular=true&sort=lastVisit|totalSpent|visitCount|name
app.get('/api/clients', auth, async (req, res) => {
  try {
    const { search, isRegular, sort } = req.query
    const conditions = []; const vals = []; let i = 1
    if (search) {
      conditions.push(`(name ILIKE $${i} OR phone ILIKE $${i} OR COALESCE(phone_normalized,'') ILIKE $${i} OR COALESCE(email,'') ILIKE $${i})`)
      vals.push(`%${search}%`); i++
    }
    if (isRegular === 'true') { conditions.push('is_regular = true') }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const orderMap = { lastVisit: 'last_visit DESC NULLS LAST', totalSpent: 'total_spent DESC', visitCount: 'visit_count DESC', name: 'name' }
    const order = orderMap[sort] || 'created_at DESC'
    const { rows: clients } = await pool.query(`SELECT * FROM clients ${where} ORDER BY ${order}`, vals)
    const { rows: cars } = await pool.query('SELECT * FROM cars WHERE client_id IS NOT NULL ORDER BY id')
    const carIds = cars.map(c => c.id)
    const { rows: history } = carIds.length
      ? await pool.query('SELECT * FROM service_history WHERE car_id = ANY($1) ORDER BY date DESC', [carIds])
      : { rows: [] }
    const carsWithHistory = cars.map(c => ({ ...mapCar(c), serviceHistory: history.filter(h => h.car_id === c.id).map(mapHistory) }))
    res.json(clients.map(c => ({
      ...mapClient(c),
      cars: carsWithHistory.filter(car => car.clientId === String(c.id)),
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/clients/lookup?q= — autocomplete by name or phone (returns minimal data + cars)
app.get('/api/clients/lookup', auth, async (req, res) => {
  try {
    const q = req.query.q || ''
    if (!q) return res.json([])
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.phone, c.email,
        (SELECT json_agg(json_build_object(
          'id', ca.id, 'make', ca.make, 'model', ca.model, 'year', ca.year,
          'licensePlate', ca.license_plate, 'engineType', ca.engine_type,
          'engineVolume', ca.engine_volume::float, 'mileage', ca.mileage
        )) FROM cars ca WHERE ca.client_id = c.id) AS cars
      FROM clients c
      WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR COALESCE(c.phone_normalized,'') ILIKE $1
      ORDER BY c.last_visit DESC NULLS LAST LIMIT 10
    `, [`%${q}%`])
    res.json(rows.map(r => ({
      id: String(r.id), name: r.name, phone: r.phone, email: r.email || undefined,
      cars: r.cars || [],
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/clients/:id — full detail with appointment history
app.get('/api/clients/:id', auth, async (req, res) => {
  try {
    const clientId = req.params.id
    // Recalc stats to ensure they are fresh before returning
    await recalcClientStats(clientId).catch(console.error)
    const { rows: [c] } = await pool.query('SELECT * FROM clients WHERE id=$1', [clientId])
    if (!c) return res.status(404).json({ error: 'Клиент не найден' })
    const { rows: cars } = await pool.query('SELECT * FROM cars WHERE client_id=$1 ORDER BY id', [c.id])
    const { rows: history } = cars.length
      ? await pool.query('SELECT * FROM service_history WHERE car_id = ANY($1) ORDER BY date DESC', [cars.map(x => x.id)])
      : { rows: [] }
    const { rows: apts } = await pool.query(
      'SELECT * FROM appointments WHERE client_id=$1 ORDER BY date DESC, time DESC LIMIT 50', [clientId]
    )
    const carsWithHistory = cars.map(car => ({ ...mapCar(car), serviceHistory: history.filter(h => h.car_id === car.id).map(mapHistory) }))
    res.json({
      ...mapClient(c),
      cars: carsWithHistory,
      appointments: apts.map(mapAppointment),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/clients', auth, async (req, res) => {
  try {
    const { name, phone, email, notes } = req.body
    const phoneNorm = normalizePhone(phone)
    const { rows } = await pool.query(
      'INSERT INTO clients (name,phone,email,notes,phone_normalized) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name, phone, email || null, notes || null, phoneNorm]
    )
    res.json({ id: String(rows[0].id) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/clients/:id', auth, async (req, res) => {
  try {
    const { name, phone, email, notes } = req.body
    const phoneNorm = normalizePhone(phone)
    await pool.query(
      'UPDATE clients SET name=$1,phone=$2,email=$3,notes=$4,phone_normalized=$5 WHERE id=$6',
      [name, phone, email || null, notes || null, phoneNorm, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/clients/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/clients/:id/merge — merge sourceId into this client
app.post('/api/clients/:id/merge', auth, async (req, res) => {
  try {
    const targetId = req.params.id
    const { sourceId } = req.body
    if (!sourceId || String(sourceId) === String(targetId)) return res.status(400).json({ error: 'Invalid merge' })
    await pool.query('UPDATE appointments SET client_id=$1 WHERE client_id=$2', [targetId, sourceId])
    await pool.query('UPDATE cars SET client_id=$1 WHERE client_id=$2', [targetId, sourceId])
    await pool.query('DELETE FROM clients WHERE id=$1', [sourceId])
    await recalcClientStats(targetId)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Corporate ────────────────────────────────────────────────────────────────
app.get('/api/corporate', auth, async (req, res) => {
  try {
    const { rows: corps } = await pool.query('SELECT * FROM corporate_clients ORDER BY id')
    const { rows: cars } = await pool.query('SELECT * FROM cars WHERE corporate_id IS NOT NULL ORDER BY id')
    const carIds = cars.map(c => c.id)
    const { rows: history } = carIds.length
      ? await pool.query('SELECT * FROM service_history WHERE car_id = ANY($1) ORDER BY date DESC', [carIds])
      : { rows: [] }
    const carsWithHistory = cars.map(c => ({
      ...mapCar(c),
      serviceHistory: history.filter(h => h.car_id === c.id).map(mapHistory),
    }))
    res.json(corps.map(c => ({
      id: String(c.id),
      companyName: c.company_name,
      contactPerson: c.contact_person,
      phone: c.phone,
      email: c.email || undefined,
      contract: c.contract || undefined,
      comment: c.comment || undefined,
      cars: carsWithHistory.filter(car => car.corporateId === String(c.id)),
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/corporate', auth, async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, contract, comment } = req.body
    const { rows } = await pool.query(
      'INSERT INTO corporate_clients (company_name,contact_person,phone,email,contract,comment) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [companyName, contactPerson, phone, email || null, contract || null, comment || null]
    )
    res.json({ id: String(rows[0].id) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/corporate/:id', auth, async (req, res) => {
  try {
    const { companyName, contactPerson, phone, email, contract, comment } = req.body
    await pool.query(
      'UPDATE corporate_clients SET company_name=$1,contact_person=$2,phone=$3,email=$4,contract=$5,comment=$6 WHERE id=$7',
      [companyName, contactPerson, phone, email || null, contract || null, comment || null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/corporate/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM corporate_clients WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Cars ─────────────────────────────────────────────────────────────────────
app.get('/api/cars', auth, async (req, res) => {
  try {
    const { rows: cars } = await pool.query('SELECT * FROM cars ORDER BY id')
    const carIds = cars.map(c => c.id)
    const { rows: history } = carIds.length
      ? await pool.query('SELECT * FROM service_history WHERE car_id = ANY($1) ORDER BY date DESC', [carIds])
      : { rows: [] }
    res.json(cars.map(c => ({
      ...mapCar(c),
      serviceHistory: history.filter(h => h.car_id === c.id).map(mapHistory),
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/cars', auth, async (req, res) => {
  try {
    const { clientId, corporateId, make, model, generation, year, engineType, engineVolume, licensePlate, vin, mileage } = req.body
    const { rows } = await pool.query(
      'INSERT INTO cars (client_id,corporate_id,make,model,generation,year,engine_type,engine_volume,license_plate,vin,mileage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
      [clientId || null, corporateId || null, make, model, generation || null, year, engineType, engineVolume, licensePlate, vin || null, mileage || 0]
    )
    res.json({ id: String(rows[0].id) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/cars/:id', auth, async (req, res) => {
  try {
    const { make, model, generation, year, engineType, engineVolume, licensePlate, vin, mileage, lastService, nextService } = req.body
    await pool.query(
      'UPDATE cars SET make=$1,model=$2,generation=$3,year=$4,engine_type=$5,engine_volume=$6,license_plate=$7,vin=$8,mileage=$9,last_service=$10,next_service=$11 WHERE id=$12',
      [make, model, generation || null, year, engineType, engineVolume, licensePlate, vin || null, mileage, lastService || null, nextService || null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/cars/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cars WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Warehouse ────────────────────────────────────────────────────────────────
app.get('/api/warehouse', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM warehouse ORDER BY category, name')
    res.json(rows.map(w => ({
      id: String(w.id),
      name: w.name,
      category: w.category,
      quantity: Number(w.quantity),
      unit: w.unit,
      minQuantity: Number(w.min_quantity),
      price: Number(w.price),
      brand: w.brand || undefined,
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/warehouse', auth, async (req, res) => {
  try {
    const { name, category, quantity, unit, minQuantity, price, brand } = req.body
    const { rows } = await pool.query(
      'INSERT INTO warehouse (name,category,quantity,unit,min_quantity,price,brand) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [name, category, quantity, unit, minQuantity, price, brand || null]
    )
    res.json({ id: String(rows[0].id) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/warehouse/:id', auth, async (req, res) => {
  try {
    const { name, category, quantity, unit, minQuantity, price, brand } = req.body
    await pool.query(
      'UPDATE warehouse SET name=$1,category=$2,quantity=$3,unit=$4,min_quantity=$5,price=$6,brand=$7 WHERE id=$8',
      [name, category, quantity, unit, minQuantity, price, brand || null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/warehouse/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM warehouse WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Public info (no auth) ────────────────────────────────────────────────────
app.get('/api/public-info', async (req, res) => {
  try {
    console.log('[public-info] serving request')
    const PUBLIC_KEYS = ['name', 'address', 'phone', 'whatsapp',
      'weekday_open', 'weekday_close', 'sat_open', 'sat_close',
      'sun_open', 'sun_close', 'sun_closed',
      'slot_duration', 'booking_days_ahead', 'social_links']
    const { rows } = await pool.query(
      `SELECT key, value FROM settings WHERE key = ANY($1)`, [PUBLIC_KEYS]
    )
    const out = {}
    rows.forEach(r => out[r.key] = r.value)
    res.json(out)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Car brands ───────────────────────────────────────────────────────────────
app.get('/api/car-brands', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, image_url FROM car_brands WHERE is_active = true ORDER BY sort_order, name'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/car-brands', auth, async (req, res) => {
  try {
    const { name, imageUrl, sortOrder = 0 } = req.body
    const { rows } = await pool.query(
      'INSERT INTO car_brands (name, image_url, sort_order) VALUES ($1,$2,$3) RETURNING id',
      [name, imageUrl || null, sortOrder]
    )
    res.json({ id: rows[0].id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/car-brands/:id', auth, async (req, res) => {
  try {
    const fields = []; const vals = []
    const { name, imageUrl, sortOrder } = req.body
    if (name !== undefined)       { fields.push(`name=$${vals.length+1}`);       vals.push(name) }
    if ('imageUrl' in req.body)   { fields.push(`image_url=$${vals.length+1}`);  vals.push(imageUrl ?? null) }
    if (sortOrder !== undefined)  { fields.push(`sort_order=$${vals.length+1}`); vals.push(sortOrder) }
    if (!fields.length) return res.json({ ok: true })
    vals.push(req.params.id)
    await pool.query(`UPDATE car_brands SET ${fields.join(',')} WHERE id=$${vals.length}`, vals)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/car-brands/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM car_brands WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/car-brands/import-zip', auth, zipUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const zipPath = req.file.path
  const cleanup = () => { try { fs.unlinkSync(zipPath) } catch {} }

  try {
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const uploadsDir = path.join(__dirname, 'uploads')

    // Collect brand logos (Mark.*) and model images (model_Name.*)
    // Expects: BrandName/Mark.ext for logos, BrandName/model_ModelName.ext for models
    const brandMap = {}
    const modelMap = {}
    for (const entry of entries) {
      if (entry.isDirectory) continue
      const parts = entry.entryName.replace(/\\/g, '/').split('/')
      if (parts.length < 2) continue
      const topFolder = parts[0]
      if (topFolder.startsWith('__') || topFolder.startsWith('.')) continue
      const fileName = parts[parts.length - 1]
      const ext = path.extname(fileName).toLowerCase()
      const origBaseName = path.basename(fileName, ext)
      const baseName = origBaseName.toLowerCase()
      if (!['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue
      if (baseName === 'mark') {
        const brandName = parts.length >= 2 ? parts[parts.length - 2] : topFolder
        if (!brandMap[brandName]) brandMap[brandName] = { entry, ext }
      } else if (baseName.startsWith('model_')) {
        const modelName = origBaseName.slice(6)
        if (!modelName) continue
        const brandName = parts.length >= 2 ? parts[parts.length - 2] : topFolder
        if (!modelMap[brandName]) modelMap[brandName] = []
        modelMap[brandName].push({ modelName, entry, ext })
      }
    }

    const imported = []
    for (const [brandName, { entry, ext }] of Object.entries(brandMap)) {
      const filename = `brand-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      fs.writeFileSync(path.join(uploadsDir, filename), entry.getData())
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`

      const { rows } = await pool.query(
        `INSERT INTO car_brands (name, image_url, sort_order)
         VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order),0)+1 FROM car_brands))
         ON CONFLICT (name) DO UPDATE SET image_url = EXCLUDED.image_url
         RETURNING id, name, image_url`,
        [brandName, imageUrl]
      )
      imported.push(rows[0])
    }

    const importedModels = []
    for (const [brandName, models] of Object.entries(modelMap)) {
      const { rows: brandRows } = await pool.query('SELECT id FROM car_brands WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))', [brandName])
      if (!brandRows.length) continue
      const brandId = brandRows[0].id
      for (const { modelName, entry, ext } of models) {
        const filename = `model-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
        fs.writeFileSync(path.join(uploadsDir, filename), entry.getData())
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`
        await pool.query(
          `INSERT INTO car_models (brand_id, name, image_url, sort_order)
           VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order),0)+1 FROM car_models WHERE brand_id=$1))
           ON CONFLICT (brand_id, name) DO UPDATE SET image_url = EXCLUDED.image_url`,
          [brandId, modelName, imageUrl]
        )
        importedModels.push(modelName)
      }
    }

    cleanup()
    res.json({ imported: imported.length, brands: imported, importedModels: importedModels.length })
  } catch (e) {
    cleanup()
    res.status(500).json({ error: e.message })
  }
})

// ─── Car models ───────────────────────────────────────────────────────────────
app.get('/api/car-models', async (req, res) => {
  try {
    const { brandId } = req.query
    if (!brandId) return res.json([])
    const { rows } = await pool.query(
      'SELECT id, name, image_url FROM car_models WHERE brand_id = $1 ORDER BY sort_order, name',
      [brandId]
    )
    res.json(rows.map(r => ({ id: r.id, name: r.name, imageUrl: r.image_url || null })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/car-models', auth, async (req, res) => {
  try {
    const { brandId, name, imageUrl, sortOrder = 0 } = req.body
    const { rows } = await pool.query(
      'INSERT INTO car_models (brand_id, name, image_url, sort_order) VALUES ($1,$2,$3,$4) RETURNING id',
      [brandId, name, imageUrl || null, sortOrder]
    )
    res.json({ id: rows[0].id })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/car-models/:id', auth, async (req, res) => {
  try {
    const fields = []; const vals = []
    const { name, imageUrl } = req.body
    if (name !== undefined)      { fields.push(`name=$${vals.length+1}`);       vals.push(name) }
    if ('imageUrl' in req.body)  { fields.push(`image_url=$${vals.length+1}`);  vals.push(imageUrl ?? null) }
    if (!fields.length) return res.json({ ok: true })
    vals.push(req.params.id)
    await pool.query(`UPDATE car_models SET ${fields.join(',')} WHERE id=$${vals.length}`, vals)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/car-models/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM car_models WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Why blocks (public) ──────────────────────────────────────────────────────
app.get('/api/why-blocks', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='why_blocks'")
    const blocks = rows.length ? JSON.parse(rows[0].value) : []
    res.json(blocks)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings')
    const out = {}
    rows.forEach(r => { out[r.key] = r.value })
    res.json(out)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/settings', auth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
        [key, String(value)]
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Upload ───────────────────────────────────────────────────────────────────
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
  res.json({ url })
})

// ─── Services ─────────────────────────────────────────────────────────────────
app.get('/api/services', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM services ORDER BY sort_order, id')
    res.json(rows.map(s => ({
      id: String(s.id), name: s.name, description: s.description || '',
      price: Number(s.price), duration: s.duration, isActive: s.is_active,
      sortOrder: s.sort_order, imageUrl: s.image_url || '',
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/services', auth, async (req, res) => {
  try {
    const { name, description, price, duration, sortOrder = 0, imageUrl } = req.body
    const { rows } = await pool.query(
      'INSERT INTO services (name,description,price,duration,sort_order,image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, description || null, price, duration, sortOrder, imageUrl || null]
    )
    res.json({ id: String(rows[0].id) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/services/:id', auth, async (req, res) => {
  try {
    const { name, description, price, duration, isActive, sortOrder, imageUrl } = req.body
    await pool.query(
      'UPDATE services SET name=$1,description=$2,price=$3,duration=$4,is_active=$5,sort_order=$6,image_url=$7 WHERE id=$8',
      [name, description || null, price, duration, isActive ?? true, sortOrder ?? 0, imageUrl || null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/services/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Public: taken time slots for a date ──────────────────────────────────────
app.get('/api/slots', async (req, res) => {
  try {
    const { date } = req.query
    if (!date) return res.json([])
    const { rows } = await pool.query(
      `SELECT time FROM appointments WHERE date = $1 AND status NOT IN ('cancelled')`,
      [date]
    )
    res.json(rows.map(r => r.time ? String(r.time).slice(0, 5) : null).filter(Boolean))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Push notifications ────────────────────────────────────────────────────────
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
})

app.post('/api/push/subscribe', auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' })
    await pool.query(
      `INSERT INTO push_subscriptions (employee_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET employee_id=$1, p256dh=$3, auth=$4`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/push/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body
    if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [endpoint])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Public booking (no auth) ─────────────────────────────────────────────────
app.post('/api/book', bookLimiter, async (req, res) => {
  try {
    const {
      clientName, clientPhone, email, comment,
      date, time, carMake, carModel, carYear, licensePlate,
      engineType, engineVolume, mileage, vin, services, oilPreference,
      service, // from quick modal (single service)
    } = req.body
    const bookDate = date || new Date().toISOString().split('T')[0]
    const bookTime = time || '09:00'
    const bookServices = Array.isArray(services) && services.length ? services : (service ? [service] : [])
    const fullComment = [email ? `Email: ${email}` : '', comment || ''].filter(Boolean).join('\n')
    const { rows: bookRows } = await pool.query(
      `INSERT INTO appointments
         (date,time,client_name,client_phone,car_make,car_model,car_year,license_plate,
          engine_type,engine_volume,mileage,vin,services,oil_preference,comment,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [bookDate, bookTime, clientName, clientPhone,
       carMake || '', carModel || '', carYear || 2024, (licensePlate || '').toUpperCase(),
       engineType || 'Бензин', engineVolume || 0, mileage || 0, vin || null,
       bookServices, oilPreference || '', fullComment || null, 'pending']
    )
    const bookAptId = bookRows[0].id
    const bookApt = { clientName, clientPhone, carMake, carModel, carYear, licensePlate, engineType, engineVolume, mileage, vin }
    findOrCreateClient(clientName, clientPhone).then(async clientId => {
      const carId = clientId ? await findOrCreateCar(clientId, bookApt) : null
      if (clientId || carId) {
        await pool.query('UPDATE appointments SET client_id=$1, car_id=$2 WHERE id=$3', [clientId, carId, bookAptId])
      }
    }).catch(console.error)
    const svcLabel = bookServices.length ? bookServices.slice(0, 2).join(', ') + (bookServices.length > 2 ? ` +${bookServices.length - 2}` : '') : ''
    sendPushToAll(
      '📋 Новая запись',
      `${clientName} · ${bookDate} ${bookTime}${svcLabel ? ' · ' + svcLabel : ''}`,
      '/crm/appointments'
    )
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Dashboard ────────────────────────────────────────────────────────────────
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const dateFrom = req.query.dateFrom || firstOfMonth
    const dateTo   = req.query.dateTo   || todayStr
    const [
      { rows: [period] },
      { rows: chart },
      { rows: services },
      { rows: oils },
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM clients WHERE created_at::date BETWEEN $1::date AND $2::date) AS new_clients,
          COALESCE(SUM(oil_liters), 0) AS oil_used,
          COALESCE(AVG(total), 0)      AS avg_check,
          COALESCE(SUM(total), 0)      AS daily_revenue
        FROM appointments
        WHERE date BETWEEN $1::date AND $2::date AND status = 'completed'
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT TO_CHAR(d.day, 'DD.MM') AS day,
               COUNT(a.id)             AS orders,
               COALESCE(SUM(a.total), 0) AS revenue
        FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS d(day)
        LEFT JOIN appointments a ON a.date = d.day AND a.status = 'completed'
        GROUP BY d.day ORDER BY d.day
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT service, COUNT(*) AS count
        FROM appointments, UNNEST(services) AS service
        WHERE status = 'completed'
        AND date BETWEEN $1::date AND $2::date
        GROUP BY service ORDER BY count DESC LIMIT 10
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT COALESCE(NULLIF(oil_brand, ''), 'Не указано') AS name,
               COALESCE(SUM(oil_liters), 0) AS liters
        FROM appointments
        WHERE status = 'completed' AND oil_liters > 0
        AND date BETWEEN $1::date AND $2::date
        GROUP BY name ORDER BY liters DESC
      `, [dateFrom, dateTo]),
    ])
    const totalSvc = services.reduce((s, r) => s + Number(r.count), 0)
    res.json({
      newClientsToday: Number(period.new_clients),
      oilUsedToday:   Number(period.oil_used),
      avgCheckToday:  Math.round(Number(period.avg_check)),
      dailyRevenue:   Number(period.daily_revenue),
      weeklyRevenue:  chart.map(r => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
      popularServices: services.map(r => ({
        name: r.service,
        count: Number(r.count),
        percent: totalSvc > 0 ? Math.round(Number(r.count) / totalSvc * 100) : 0,
      })),
      oilBrands: oils.map(r => ({ name: r.name, liters: Number(r.liters) })),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// ─── Analytics ────────────────────────────────────────────────────────────────
app.get('/api/analytics', auth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const yearStart = `${new Date().getFullYear()}-01-01`
    const dateFrom = req.query.dateFrom || yearStart
    const dateTo   = req.query.dateTo   || todayStr
    const [
      { rows: [apptSummary] },
      { rows: [clientSummary] },
      { rows: monthly },
      { rows: weekly },
      { rows: services },
      { rows: makes },
      { rows: oils },
      { rows: masters },
    ] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total), 0)          AS total_revenue,
          COALESCE(AVG(total), 0)          AS avg_check,
          COUNT(*)                         AS total_orders,
          COALESCE(SUM(oil_liters), 0)     AS oil_used,
          COUNT(CASE WHEN oil_filter   IS NOT NULL AND oil_filter   != '' THEN 1 END) +
          COUNT(CASE WHEN air_filter   IS NOT NULL AND air_filter   != '' THEN 1 END) +
          COUNT(CASE WHEN cabin_filter IS NOT NULL AND cabin_filter != '' THEN 1 END) AS filters_changed
        FROM appointments WHERE status = 'completed'
        AND date BETWEEN $1::date AND $2::date
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT
          COUNT(*)                                                                       AS total_clients,
          COUNT(CASE WHEN created_at::date BETWEEN $1::date AND $2::date THEN 1 END)   AS new_clients,
          COUNT(CASE WHEN visit_count > 1 THEN 1 END)                                  AS repeat_clients
        FROM clients
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT TO_CHAR(m.month, 'Mon YYYY') AS month,
               COALESCE(SUM(a.total), 0) AS revenue
        FROM generate_series(
          DATE_TRUNC('month', $1::date),
          DATE_TRUNC('month', $2::date),
          INTERVAL '1 month'
        ) AS m(month)
        LEFT JOIN appointments a
          ON DATE_TRUNC('month', a.date::timestamp) = m.month AND a.status = 'completed'
          AND a.date BETWEEN $1::date AND $2::date
        GROUP BY m.month ORDER BY m.month
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT TO_CHAR(d.day, 'DD.MM') AS day,
               COUNT(a.id) AS orders,
               COALESCE(SUM(a.total), 0) AS revenue
        FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS d(day)
        LEFT JOIN appointments a ON a.date = d.day AND a.status = 'completed'
        GROUP BY d.day ORDER BY d.day
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT service, COUNT(*) AS count
        FROM appointments, UNNEST(services) AS service
        WHERE status = 'completed'
        AND date BETWEEN $1::date AND $2::date
        GROUP BY service ORDER BY count DESC LIMIT 5
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT car_make AS name, COUNT(*) AS count
        FROM appointments WHERE status = 'completed'
        AND date BETWEEN $1::date AND $2::date
        GROUP BY car_make ORDER BY count DESC LIMIT 6
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT oil_brand AS name, COALESCE(SUM(oil_liters), 0) AS liters
        FROM appointments
        WHERE status = 'completed' AND oil_brand IS NOT NULL AND oil_brand != ''
        AND date BETWEEN $1::date AND $2::date
        GROUP BY oil_brand ORDER BY liters DESC
      `, [dateFrom, dateTo]),
      pool.query(`
        SELECT e.name, COUNT(*) AS orders
        FROM appointments a JOIN employees e ON a.master_id = e.id
        WHERE a.status = 'completed'
        AND a.date BETWEEN $1::date AND $2::date
        GROUP BY e.id, e.name ORDER BY orders DESC LIMIT 5
      `, [dateFrom, dateTo]),
    ])

    const totalServiceCount = services.reduce((s, r) => s + Number(r.count), 0)

    res.json({
      summary: {
        totalRevenue:   Math.round(Number(apptSummary.total_revenue)),
        avgCheck:       Math.round(Number(apptSummary.avg_check)),
        totalOrders:    Number(apptSummary.total_orders),
        totalClients:   Number(clientSummary.total_clients),
        newClients:     Number(clientSummary.new_clients),
        repeatClients:  Number(clientSummary.repeat_clients),
        oilUsed:        Number(apptSummary.oil_used),
        filtersChanged: Number(apptSummary.filters_changed),
      },
      monthlyRevenue: monthly.map(r => ({ month: r.month, revenue: Number(r.revenue) })),
      weeklyRevenue:  weekly.map(r => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
      popularServices: services.map(r => ({
        name: r.service,
        count: Number(r.count),
        percent: totalServiceCount > 0 ? Math.round(Number(r.count) / totalServiceCount * 100) : 0,
      })),
      popularMakes: makes.map(r => ({ name: r.name, count: Number(r.count) })),
      oilBrands:    oils.map(r => ({ name: r.name, liters: Number(r.liters) })),
      masters:      masters.map(r => ({ name: r.name, orders: Number(r.orders) })),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, async () => {
  await pool.query('ALTER TABLE cars ADD COLUMN IF NOT EXISTS generation TEXT').catch(() => {})
  // Ensure client tracking columns and indexes exist (idempotent)
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(20)`).catch(() => {})
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_regular BOOLEAN NOT NULL DEFAULT false`).catch(() => {})
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_visit_at DATE`).catch(() => {})
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {})
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL`).catch(() => {})
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS car_id INT REFERENCES cars(id) ON DELETE SET NULL`).catch(() => {})
  await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS plate_normalized VARCHAR(20)`).catch(() => {})
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_phone_norm ON clients(phone_normalized) WHERE phone_normalized IS NOT NULL`).catch(() => {})
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_plate_norm ON cars(plate_normalized) WHERE plate_normalized IS NOT NULL`).catch(() => {})
  await pool.query(`INSERT INTO settings (key, value) VALUES ('regular_client_threshold', '3') ON CONFLICT (key) DO NOTHING`).catch(() => {})
  await pool.query(`
    CREATE TABLE IF NOT EXISTS car_models (
      id SERIAL PRIMARY KEY,
      brand_id INTEGER REFERENCES car_brands(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(brand_id, name)
    )
  `).catch(e => console.error('car_models init:', e.message))
  console.log(`✅ API: http://localhost:${PORT}`)
})
