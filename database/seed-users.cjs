#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') })
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'garage56',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

const USERS = [
  { name: 'Владимир Гаражников', email: 'owner@garage56.kz',   password: 'owner123',  role: 'owner',     phone: null,               spec: null },
  { name: 'Анна Администратор',  email: 'admin@garage56.kz',   password: 'admin123',  role: 'admin',     phone: null,               spec: null },
  { name: 'Асан Сейткали',       email: 'master@garage56.kz',  password: 'master123', role: 'master',    phone: '+7 (701) 234-56-78', spec: 'Замена масел, фильтры' },
  { name: 'Игорь Петренко',      email: 'master2@garage56.kz', password: 'master123', role: 'master',    phone: '+7 (702) 345-67-89', spec: 'АКПП, трансмиссия' },
  { name: 'Нуркен Алтаев',       email: 'master3@garage56.kz', password: 'master123', role: 'master',    phone: '+7 (707) 456-78-90', spec: 'Кондиционеры, электрика' },
  { name: 'Таксопарк Express',   email: 'corp@taxi.kz',        password: 'corp123',   role: 'corporate', phone: null,               spec: null },
]

async function run() {
  try {
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10)
      await pool.query(
        `INSERT INTO employees (name, email, password_hash, role, phone, specialization, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (email) DO UPDATE
           SET password_hash  = EXCLUDED.password_hash,
               name           = EXCLUDED.name,
               role           = EXCLUDED.role,
               phone          = EXCLUDED.phone,
               specialization = EXCLUDED.specialization,
               is_active      = true`,
        [u.name, u.email, hash, u.role, u.phone, u.spec]
      )
      console.log(`OK  ${u.role.padEnd(10)}  ${u.email}  (пароль: ${u.password})`)
    }
    console.log('\nГотово! Все пользователи добавлены.')
  } catch (e) {
    console.error('Ошибка:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()
