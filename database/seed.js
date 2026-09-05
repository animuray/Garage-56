#!/usr/bin/env node
// Seeding initial data into the database
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'garage56',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Employees ───────────────────────────────────────────────────────────
    console.log('Seeding employees...')
    const passwords = {
      owner:  await bcrypt.hash('owner123',  10),
      admin:  await bcrypt.hash('admin123',  10),
      master: await bcrypt.hash('master123', 10),
      corp:   await bcrypt.hash('corp123',   10),
    }

    const { rows: [emp1] } = await client.query(
      `INSERT INTO employees (name,email,password_hash,role,phone,specialization)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Владимир Гаражников', 'owner@garage56.kz', passwords.owner, 'owner', null, null]
    )
    const { rows: [emp2] } = await client.query(
      `INSERT INTO employees (name,email,password_hash,role,phone,specialization)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Анна Администратор', 'admin@garage56.kz', passwords.admin, 'admin', null, null]
    )
    const { rows: [emp3] } = await client.query(
      `INSERT INTO employees (name,email,password_hash,role,phone,specialization)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Асан Сейткали', 'master@garage56.kz', passwords.master, 'master', '+7 (701) 234-56-78', 'Замена масел, фильтры']
    )
    const { rows: [emp4] } = await client.query(
      `INSERT INTO employees (name,email,password_hash,role,phone,specialization)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Игорь Петренко', 'master2@garage56.kz', await bcrypt.hash('master123', 10), 'master', '+7 (702) 345-67-89', 'АКПП, трансмиссия']
    )
    const { rows: [emp5] } = await client.query(
      `INSERT INTO employees (name,email,password_hash,role,phone,specialization)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Нуркен Алтаев', 'master3@garage56.kz', await bcrypt.hash('master123', 10), 'master', '+7 (707) 456-78-90', 'Кондиционеры, электрика']
    )

    const m1 = emp3.id, m2 = emp4.id, m3 = emp5.id

    // ── Clients ─────────────────────────────────────────────────────────────
    console.log('Seeding clients...')
    const insertClient = async (name, phone, email, visits, lastVisit, spent, createdAt) => {
      const { rows: [r] } = await client.query(
        `INSERT INTO clients (name,phone,email,visit_count,last_visit,total_spent,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [name, phone, email, visits, lastVisit, spent, createdAt]
      )
      return r.id
    }

    const cl1 = await insertClient('Алексей Иванов',   '+7 (701) 123-45-67', 'alexey@mail.kz',      8,  '2025-04-20', 42000, '2023-01-15')
    const cl2 = await insertClient('Николай Козлов',   '+7 (702) 234-56-78', 'n.kozlov@gmail.com',  3,  '2025-05-01', 36000, '2024-02-20')
    const cl3 = await insertClient('Гульнара Абенова', '+7 (707) 345-67-89', null,                  2,  '2025-03-15',  8500, '2024-06-10')
    const cl4 = await insertClient('Арман Сейткали',   '+7 (747) 456-78-90', 'arman@kz.kz',         4,  '2025-04-05', 18000, '2023-08-22')
    const cl5 = await insertClient('Светлана Мороз',   '+7 (771) 567-89-01', null,                  1,  '2025-05-12',  3500, '2025-05-12')
    const cl6 = await insertClient('Марат Жаксыбеков', '+7 (778) 678-90-12', 'marat.zh@mail.kz',   12,  '2025-05-14', 58000, '2022-11-05')
    const cl7 = await insertClient('Евгений Петров',   '+7 (701) 789-01-23', null,                  5,  '2025-05-10', 22000, '2023-05-20')
    const cl8 = await insertClient('Айгерим Нурланова','+7 (702) 890-12-34', 'aig@gmail.com',       6,  '2025-04-28', 31000, '2023-03-01')
    const cl9 = await insertClient('Дмитрий Смирнов',  '+7 (707) 901-23-45', null,                  9,  '2025-05-14', 47000, '2022-07-14')
    const cl10= await insertClient('Людмила Морозова', '+7 (747) 012-34-56', 'l.morozova@mail.kz',  7,  '2025-05-02', 38000, '2023-02-18')

    // ── Corporate clients ───────────────────────────────────────────────────
    console.log('Seeding corporate clients...')
    const { rows: [corp1] } = await client.query(
      `INSERT INTO corporate_clients (company_name,contact_person,phone,email,contract,comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Таксопарк Express','Айдар Нурмагамбетов','+7 (701) 111-22-33','manager@taxi-express.kz',
       '№ 2024-01 от 01.01.2024','Крупный клиент. Регулярное обслуживание каждые 7 000 км.']
    )
    const { rows: [corp2] } = await client.query(
      `INSERT INTO corporate_clients (company_name,contact_person,phone,email,contract,comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['ООО "АвтоЛогистик"','Сергей Дмитриев','+7 (702) 222-33-44','s.dmitriev@avto-logistik.kz',
       '№ 2024-05 от 01.03.2024','Грузовые автомобили и минивэны.']
    )
    const { rows: [corp3] } = await client.query(
      `INSERT INTO corporate_clients (company_name,contact_person,phone,email)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['RentCar Service','Алина Бектурова','+7 (707) 333-44-55','alina@rentcar.kz']
    )
    const { rows: [corp4] } = await client.query(
      `INSERT INTO corporate_clients (company_name,contact_person,phone,email)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      ['ООО "Доставка 24"','Максим Соколов','+7 (747) 444-55-66','m.sokolov@dostavka24.kz']
    )

    // Update corp employee
    await client.query('UPDATE employees SET corporate_id=$1 WHERE id=$2', [corp1.id, /* taxi corp user placeholder */ null])

    // ── Cars (client cars) ──────────────────────────────────────────────────
    console.log('Seeding cars...')
    const insertCar = async (clientId, corpId, make, model, year, et, ev, plate, vin, mileage, lastSvc, nextSvc) => {
      const { rows: [r] } = await client.query(
        `INSERT INTO cars (client_id,corporate_id,make,model,year,engine_type,engine_volume,license_plate,vin,mileage,last_service,next_service)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [clientId, corpId, make, model, year, et, ev, plate, vin, mileage, lastSvc, nextSvc]
      )
      return r.id
    }

    const car1 = await insertCar(cl1, null, 'Toyota',   'Corolla',  2018, 'gasoline', 1.6, 'A123BC',   null,                 95000, '2025-04-20', '2025-06-20')
    const car2 = await insertCar(cl2, null, 'BMW',      '3 Series', 2019, 'gasoline', 2.0, 'B456DE',   'WBA8E9G55GNT12345',  78000, '2025-05-01', '2025-07-01')
    const car3 = await insertCar(cl3, null, 'Hyundai',  'Creta',    2021, 'gasoline', 2.0, 'C789GH',   null,                 45000, '2025-03-15', '2025-06-15')
    const car4 = await insertCar(cl4, null, 'Nissan',   'Qashqai',  2020, 'gasoline', 2.0, 'D012IJ',   null,                 62000, '2025-04-05', '2025-06-05')
    const car5 = await insertCar(cl5, null, 'Kia',      'Sportage', 2022, 'gasoline', 2.0, 'E345KL',   null,                 32000, '2025-05-12', '2025-07-12')

    // Corporate cars — Таксопарк Express
    const cc1 = await insertCar(null, corp1.id, 'Toyota',    'Camry',   2021, 'gasoline', 2.5, '123ABC01', 'JTNB8F4FX203456789', 125000, '2025-05-15', '2025-07-10')
    const cc2 = await insertCar(null, corp1.id, 'Hyundai',   'Accent',  2020, 'gasoline', 1.6, '456DEF02', '5NPD84LF5JH123456',   98000, '2025-05-14', '2025-08-09')
    const cc3 = await insertCar(null, corp1.id, 'Kia',       'Rio',     2019, 'gasoline', 1.4, '789GH03',  null,                  110500, '2025-04-12', '2025-06-07')
    const cc4 = await insertCar(null, corp1.id, 'Chevrolet', 'Cobalt',  2018, 'gasoline', 1.5, '321JKL04', null,                  132000, '2025-05-10', '2025-07-05')
    const cc5 = await insertCar(null, corp1.id, 'Lada',      'Vesta',   2022, 'gasoline', 1.6, '654MNO05', null,                   87000, '2025-05-08', '2025-07-03')
    const cc6 = await insertCar(null, corp1.id, 'Toyota',    'Camry',   2020, 'gasoline', 2.5, '987PQR06', null,                  143000, '2025-05-05', '2025-07-01')
    const cc7 = await insertCar(null, corp1.id, 'Hyundai',   'Accent',  2021, 'gasoline', 1.6, '234STU07', null,                   67000, '2025-05-12', '2025-07-10')
    const cc8 = await insertCar(null, corp1.id, 'Kia',       'Rio',     2020, 'gasoline', 1.6, '567VWX08', null,                   89000, '2025-04-30', '2025-06-30')
    // АвтоЛогистик
    const cc9 = await insertCar(null, corp2.id, 'Toyota',       'HiAce',    2020, 'diesel', 2.8, 'ABC123KZ', null, 145000, '2025-04-20', '2025-06-20')
    const cc10= await insertCar(null, corp2.id, 'Mercedes-Benz','Sprinter', 2021, 'diesel', 2.2, 'DEF456KZ', null,  98000, '2025-05-01', '2025-07-01')
    // RentCar
    const cc11= await insertCar(null, corp3.id, 'Hyundai', 'Creta', 2022, 'gasoline', 2.0, 'GHI789KZ', null, 67000, '2025-05-20', '2025-07-20')

    // ── Service history ─────────────────────────────────────────────────────
    console.log('Seeding service history...')
    const insertHistory = async (carId, date, mileage, services, oil, oilFilter, airFilter, cabinFilter, total, masterName) => {
      await client.query(
        `INSERT INTO service_history
           (car_id,date,mileage,services,oil_brand,oil_viscosity,oil_liters,oil_filter,air_filter,cabin_filter,total,master_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [carId, date, mileage, services,
         oil?.brand||null, oil?.viscosity||null, oil?.liters||null,
         oilFilter||null, airFilter||null, cabinFilter||null, total, masterName]
      )
    }

    await insertHistory(car1, '2025-04-20', 95000, ['Замена масла двигателя','Замена воздушного фильтра'],
      {brand:'Castrol EDGE',viscosity:'5W-30',liters:3.8}, 'MANN W713/28', 'MANN C24012', null, 5000, 'Асан Сейткали')
    await insertHistory(car1, '2024-10-15', 85000, ['Замена масла двигателя'],
      {brand:'Shell Helix HX8',viscosity:'5W-30',liters:3.8}, 'MANN W713/28', null, null, 3500, 'Асан Сейткали')
    await insertHistory(car2, '2025-05-01', 78000, ['Замена масла двигателя','Замена масла АКПП','Замена салонного фильтра'],
      {brand:'Liqui Moly',viscosity:'5W-30',liters:5.5}, 'MANN W7032', null, 'MANN CU2360', 18000, 'Игорь Петренко')
    await insertHistory(cc1, '2025-05-15', 125000, ['Замена масла двигателя','Замена воздушного фильтра','Замена салонного фильтра'],
      {brand:'Shell Helix HX8',viscosity:'5W-30',liters:4.5}, 'MANN W712/95', 'MANN C25114/1', 'MANN CU2939', 8500, 'Асан Сейткали')
    await insertHistory(cc1, '2025-02-10', 118000, ['Замена масла двигателя'],
      {brand:'Shell Helix HX8',viscosity:'5W-30',liters:4.5}, 'MANN W712/95', null, null, 3500, 'Игорь Петренко')
    await insertHistory(cc2, '2025-05-14', 98000, ['Замена масла двигателя','Замена салонного фильтра'],
      {brand:'Mobil 1',viscosity:'5W-40',liters:4.0}, 'Knecht OC 123', null, 'FILTRON K1285', 5000, 'Асан Сейткали')
    await insertHistory(cc3, '2025-04-12', 110500, ['Замена масла АКПП'],
      null, null, null, null, 8000, 'Игорь Петренко')

    // ── Appointments ─────────────────────────────────────────────────────────
    console.log('Seeding appointments...')
    const insertApt = async (date, time, clientName, clientPhone, carMake, carModel, carYear, plate, et, ev, mileage, services, oilPref, status, masterId, corpId, total) => {
      await client.query(
        `INSERT INTO appointments
           (date,time,client_name,client_phone,car_make,car_model,car_year,license_plate,
            engine_type,engine_volume,mileage,services,oil_preference,status,master_id,corporate_id,total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [date,time,clientName,clientPhone,carMake,carModel,carYear,plate,et,ev,mileage,services,oilPref,status,masterId,corpId,total||null]
      )
    }

    await insertApt('2025-05-15','09:00','Алексей Иванов',   '+7 (701) 123-45-67','Toyota',  'Corolla',  2018,'A123BC',  'Бензин',1.6, 95000,['Замена масла двигателя','Замена воздушного фильтра'],  'Shell Helix HX8 5W-30','completed',m1,null,5000)
    await insertApt('2025-05-15','10:00','Гульнара Абенова', '+7 (707) 345-67-89','Hyundai', 'Creta',    2021,'C789GH',  'Бензин',2.0, 45000,['Замена масла двигателя','Замена салонного фильтра'],   'Подберет сервис',      'in_progress',m2,null,null)
    await insertApt('2025-05-15','11:00','Таксопарк Express','+7 (701) 111-22-33','Toyota',  'Camry',    2021,'123ABC01','Бензин',2.5,125000,['Замена масла двигателя','Замена воздушного фильтра','Замена салонного фильтра'],'Shell Helix HX8 5W-30','in_progress',m1,corp1.id,null)
    await insertApt('2025-05-15','13:00','Арман Сейткали',   '+7 (747) 456-78-90','Nissan',  'Qashqai',  2020,'D012IJ',  'Бензин',2.0, 62000,['Заправка кондиционера'],                               'Не требуется',         'pending',null,null,null)
    await insertApt('2025-05-15','14:00','Светлана Мороз',   '+7 (771) 567-89-01','Kia',     'Sportage', 2022,'E345KL',  'Бензин',2.0, 32000,['Замена масла двигателя'],                              'Mobil 1 5W-40',         'pending',m3,null,null)
    await insertApt('2025-05-15','15:00','Николай Козлов',   '+7 (702) 234-56-78','BMW',     '3 Series', 2019,'B456DE',  'Бензин',2.0, 78000,['Замена масла двигателя','Замена масла АКПП'],          'Liqui Moly 5W-30',     'pending',m2,null,null)
    await insertApt('2025-05-14','09:00','Марат Жаксыбеков', '+7 (778) 678-90-12','Toyota',  'Land Cruiser',2020,'F678MN','Дизель',4.5,112000,['Замена масла двигателя','Замена масла в редукторе'], 'Castrol EDGE 5W-40',   'completed',m1,null,8000)
    await insertApt('2025-05-14','11:00','Евгений Петров',   '+7 (701) 789-01-23','Volkswagen','Polo',   2018,'G901OP',  'Бензин',1.6, 88000,['Замена масла двигателя','Замена воздушного фильтра','Замена салонного фильтра'],'Shell Helix HX8 5W-30','completed',m3,null,6500)
    await insertApt('2025-05-14','14:00','Айгерим Нурланова','+7 (702) 890-12-34','Hyundai', 'Tucson',   2021,'H234QR',  'Бензин',2.0, 55000,['Замена масла двигателя'],                              'Подберет сервис',       'completed',m1,null,3500)
    await insertApt('2025-05-16','09:00','Дмитрий Смирнов',  '+7 (707) 901-23-45','Lada',    'Vesta',    2022,'I567ST',  'Бензин',1.6, 42000,['Замена масла двигателя','Замена топливного фильтра'], 'Подберет сервис',       'pending',null,null,null)
    await insertApt('2025-05-16','11:00','Людмила Морозова', '+7 (747) 012-34-56','Kia',     'Rio',      2020,'J890UV',  'Бензин',1.4, 73000,['Замена масла двигателя','Замена салонного фильтра','Замена воздушного фильтра'],'Liqui Moly 5W-30','pending',null,null,null)

    // ── Warehouse ────────────────────────────────────────────────────────────
    console.log('Seeding warehouse...')
    const wh = [
      ['Shell Helix HX8 5W-30','oil',48,'л',20,2800,'Shell'],
      ['Mobil 1 5W-40','oil',32,'л',20,3200,'Mobil'],
      ['Castrol EDGE 5W-30','oil',16,'л',20,3000,'Castrol'],
      ['Liqui Moly 5W-40','oil',8,'л',20,3500,'Liqui Moly'],
      ['Shell ATF SP-IV (АКПП)','oil',24,'л',10,4500,'Shell'],
      ['MANN W712/95 (масляный)','filter',25,'шт',15,850,'MANN'],
      ['MANN C25114/1 (воздушный)','filter',18,'шт',10,1200,'MANN'],
      ['MANN CU2939 (салонный)','filter',12,'шт',10,950,'MANN'],
      ['FILTRON PP 988 (топливный)','filter',8,'шт',10,1800,'FILTRON'],
      ['Knecht OC 123 (масляный)','filter',20,'шт',10,750,'Knecht'],
      ['Антифриз G11 Green','antifreeze',60,'л',30,450,'FELIX'],
      ['Антифриз G12+ Red','antifreeze',40,'л',20,550,'FELIX'],
      ['Фреон R134a','freon',15,'кг',5,3500,'Dupont'],
      ['Фреон R1234yf','freon',3,'кг',3,8500,'Honeywell'],
      ['Тормозная жидкость DOT 4','brake_fluid',12,'л',5,650,'LIQUI MOLY'],
    ]
    for (const [name,cat,qty,unit,minQty,price,brand] of wh) {
      await client.query(
        'INSERT INTO warehouse (name,category,quantity,unit,min_quantity,price,brand) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [name, cat, qty, unit, minQty, price, brand]
      )
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    console.log('Seeding settings...')
    const settings = [
      ['name',            'Garage 56'],
      ['address',         'г. Алматы, ул. Примерная, 56'],
      ['phone',           '+7 (701) 123-45-67'],
      ['whatsapp',        '+7 (701) 123-45-67'],
      ['email',           'info@garage56.kz'],
      ['weekday_open',    '09:00'],
      ['weekday_close',   '19:00'],
      ['sat_open',        '09:00'],
      ['sat_close',       '18:00'],
      ['sun_open',        '10:00'],
      ['sun_close',       '17:00'],
      ['sun_closed',      'false'],
      ['slot_duration',   '60'],
      ['max_slots',       '8'],
      ['booking_days_ahead', '14'],
    ]
    for (const [key, value] of settings) {
      await client.query(
        'INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
        [key, value]
      )
    }

    await client.query('COMMIT')
    console.log('✅ Seed complete!')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', e.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
