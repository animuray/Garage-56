import type { Appointment, Car, Client, CorporateClient, Master, Service, WarehouseItem } from '../types'

export const SERVICES: Service[] = [
  { id: 's1', name: 'Замена масла двигателя', description: 'Замена моторного масла и масляного фильтра. Масла ведущих брендов: Shell, Mobil, Castrol, Liqui Moly. Бесплатная диагностика уровней жидкостей.', price: 3500, duration: 30 },
  { id: 's2', name: 'Замена масла АКПП', description: 'Замена трансмиссионного масла в автоматической коробке передач. Продление ресурса АКПП и улучшение переключений.', price: 8000, duration: 60 },
  { id: 's3', name: 'Замена масла МКПП', description: 'Замена масла в механической коробке передач. Улучшение переключения передач и снижение износа шестерён.', price: 5000, duration: 45 },
  { id: 's4', name: 'Замена масла в редукторе', description: 'Замена масла в переднем или заднем редукторе для полноприводных автомобилей. Защита трансмиссии от износа.', price: 4500, duration: 45 },
  { id: 's5', name: 'Замена воздушного фильтра', description: 'Замена воздушного фильтра двигателя. Улучшение тяги, экономия топлива и защита двигателя от загрязнений.', price: 1500, duration: 15 },
  { id: 's6', name: 'Замена салонного фильтра', description: 'Замена фильтра салона. Чистый воздух без пыли, аллергенов и неприятных запахов.', price: 1500, duration: 15 },
  { id: 's7', name: 'Замена топливного фильтра', description: 'Замена топливного фильтра для чистоты топливной системы и защиты форсунок от загрязнений.', price: 2500, duration: 30 },
  { id: 's8', name: 'Заправка кондиционера', description: 'Диагностика и заправка системы кондиционирования фреоном. Восстановление охлаждающей эффективности.', price: 6000, duration: 60 },
]

export const MASTERS: Master[] = [
  { id: 'm1', name: 'Асан Сейткали', phone: '+7 (701) 234-56-78', specialization: 'Замена масел, фильтры' },
  { id: 'm2', name: 'Игорь Петренко', phone: '+7 (702) 345-67-89', specialization: 'АКПП, трансмиссия' },
  { id: 'm3', name: 'Нуркен Алтаев', phone: '+7 (707) 456-78-90', specialization: 'Кондиционеры, электрика' },
]

export const USERS = [
  { id: 'u1', name: 'Владимир Гаражников', email: 'owner@garage56.kz', password: 'owner123', role: 'owner' as const },
  { id: 'u2', name: 'Анна Администратор', email: 'admin@garage56.kz', password: 'admin123', role: 'admin' as const },
  { id: 'u3', name: 'Асан Сейткали', email: 'master@garage56.kz', password: 'master123', role: 'master' as const, masterId: 'm1' },
  { id: 'u4', name: 'Таксопарк Express', email: 'corp@taxi.kz', password: 'corp123', role: 'corporate' as const, corporateId: 'corp1' },
]

const corporateCars: Car[] = [
  {
    id: 'cc1', corporateId: 'corp1', make: 'Toyota', model: 'Camry', year: 2021,
    engineType: 'gasoline', engineVolume: 2.5, licensePlate: '123ABC01', vin: 'JTNB8F4FX203456789',
    mileage: 125000, lastService: '2025-05-15', nextService: '2025-07-10',
    serviceHistory: [
      {
        id: 'sh1', date: '2025-05-15', mileage: 125000,
        services: ['Замена масла двигателя', 'Замена воздушного фильтра', 'Замена салонного фильтра'],
        oil: { brand: 'Shell Helix HX8', viscosity: '5W-30', liters: 4.5 },
        filters: { oil: 'MANN W712/95', air: 'MANN C25114/1', cabin: 'MANN CU2939' },
        total: 8500, masterName: 'Асан Сейткали',
      },
      {
        id: 'sh2', date: '2025-02-10', mileage: 118000,
        services: ['Замена масла двигателя'],
        oil: { brand: 'Shell Helix HX8', viscosity: '5W-30', liters: 4.5 },
        filters: { oil: 'MANN W712/95' },
        total: 3500, masterName: 'Игорь Петренко',
      },
    ],
  },
  {
    id: 'cc2', corporateId: 'corp1', make: 'Hyundai', model: 'Accent', year: 2020,
    engineType: 'gasoline', engineVolume: 1.6, licensePlate: '456DEF02', vin: '5NPD84LF5JH123456',
    mileage: 98000, lastService: '2025-05-14', nextService: '2025-08-09',
    serviceHistory: [
      {
        id: 'sh3', date: '2025-05-14', mileage: 98000,
        services: ['Замена масла двигателя', 'Замена салонного фильтра'],
        oil: { brand: 'Mobil 1', viscosity: '5W-40', liters: 4.0 },
        filters: { oil: 'Knecht OC 123', cabin: 'FILTRON K1285' },
        total: 5000, masterName: 'Асан Сейткали',
      },
    ],
  },
  {
    id: 'cc3', corporateId: 'corp1', make: 'Kia', model: 'Rio', year: 2019,
    engineType: 'gasoline', engineVolume: 1.4, licensePlate: '789GH03',
    mileage: 110500, lastService: '2025-04-12', nextService: '2025-06-07',
    serviceHistory: [
      {
        id: 'sh4', date: '2025-04-12', mileage: 110500,
        services: ['Замена масла АКПП'],
        filters: {},
        total: 8000, masterName: 'Игорь Петренко',
      },
    ],
  },
  {
    id: 'cc4', corporateId: 'corp1', make: 'Chevrolet', model: 'Cobalt', year: 2018,
    engineType: 'gasoline', engineVolume: 1.5, licensePlate: '321JKL04',
    mileage: 132000, lastService: '2025-05-10', nextService: '2025-07-05',
    serviceHistory: [],
  },
  {
    id: 'cc5', corporateId: 'corp1', make: 'Lada', model: 'Vesta', year: 2022,
    engineType: 'gasoline', engineVolume: 1.6, licensePlate: '654MNO05',
    mileage: 87000, lastService: '2025-05-08', nextService: '2025-07-03',
    serviceHistory: [],
  },
  {
    id: 'cc6', corporateId: 'corp1', make: 'Toyota', model: 'Camry', year: 2020,
    engineType: 'gasoline', engineVolume: 2.5, licensePlate: '987PQR06',
    mileage: 143000, lastService: '2025-05-05', nextService: '2025-07-01',
    serviceHistory: [],
  },
  {
    id: 'cc7', corporateId: 'corp1', make: 'Hyundai', model: 'Accent', year: 2021,
    engineType: 'gasoline', engineVolume: 1.6, licensePlate: '234STU07',
    mileage: 67000, lastService: '2025-05-12', nextService: '2025-07-10',
    serviceHistory: [],
  },
  {
    id: 'cc8', corporateId: 'corp1', make: 'Kia', model: 'Rio', year: 2020,
    engineType: 'gasoline', engineVolume: 1.6, licensePlate: '567VWX08',
    mileage: 89000, lastService: '2025-04-30', nextService: '2025-06-30',
    serviceHistory: [],
  },
]

const corp2Cars: Car[] = [
  {
    id: 'cc9', corporateId: 'corp2', make: 'Toyota', model: 'HiAce', year: 2020,
    engineType: 'diesel', engineVolume: 2.8, licensePlate: 'ABC123KZ',
    mileage: 145000, lastService: '2025-04-20', nextService: '2025-06-20',
    serviceHistory: [],
  },
  {
    id: 'cc10', corporateId: 'corp2', make: 'Mercedes-Benz', model: 'Sprinter', year: 2021,
    engineType: 'diesel', engineVolume: 2.2, licensePlate: 'DEF456KZ',
    mileage: 98000, lastService: '2025-05-01', nextService: '2025-07-01',
    serviceHistory: [],
  },
]

export const CORPORATE_CLIENTS: CorporateClient[] = [
  {
    id: 'corp1', companyName: 'Таксопарк Express', contactPerson: 'Айдар Нурмагамбетов',
    phone: '+7 (701) 111-22-33', email: 'manager@taxi-express.kz',
    contract: '№ 2024-01 от 01.01.2024',
    comment: 'Крупный клиент. Регулярное обслуживание каждые 7 000 км.',
    cars: corporateCars,
  },
  {
    id: 'corp2', companyName: 'ООО "АвтоЛогистик"', contactPerson: 'Сергей Дмитриев',
    phone: '+7 (702) 222-33-44', email: 's.dmitriev@avto-logistik.kz',
    contract: '№ 2024-05 от 01.03.2024',
    comment: 'Грузовые автомобили и минивэны.',
    cars: corp2Cars,
  },
  {
    id: 'corp3', companyName: 'RentCar Service', contactPerson: 'Алина Бектурова',
    phone: '+7 (707) 333-44-55', email: 'alina@rentcar.kz',
    cars: [
      {
        id: 'cc11', corporateId: 'corp3', make: 'Hyundai', model: 'Creta', year: 2022,
        engineType: 'gasoline', engineVolume: 2.0, licensePlate: 'GHI789KZ',
        mileage: 67000, lastService: '2025-05-20', nextService: '2025-07-20',
        serviceHistory: [],
      },
    ],
  },
  {
    id: 'corp4', companyName: 'ООО "Доставка 24"', contactPerson: 'Максим Соколов',
    phone: '+7 (747) 444-55-66', email: 'm.sokolov@dostavka24.kz',
    cars: [],
  },
]

export const CLIENTS: Client[] = [
  {
    id: 'cl1', name: 'Алексей Иванов', phone: '+7 (701) 123-45-67', email: 'alexey@mail.kz',
    visitCount: 8, lastVisit: '2025-04-20', createdAt: '2023-01-15',
    totalSpent: 42000, isRegular: true,
    cars: [{
      id: 'car1', clientId: 'cl1', make: 'Toyota', model: 'Corolla', year: 2018,
      engineType: 'gasoline', engineVolume: 1.6, licensePlate: 'A123BC',
      mileage: 95000, lastService: '2025-04-20', nextService: '2025-06-20',
      serviceHistory: [
        {
          id: 'h1', date: '2025-04-20', mileage: 95000,
          services: ['Замена масла двигателя', 'Замена воздушного фильтра'],
          oil: { brand: 'Castrol EDGE', viscosity: '5W-30', liters: 3.8 },
          filters: { oil: 'MANN W713/28', air: 'MANN C24012' },
          total: 5000, masterName: 'Асан Сейткали',
        },
        {
          id: 'h2', date: '2024-10-15', mileage: 85000,
          services: ['Замена масла двигателя'],
          oil: { brand: 'Shell Helix HX8', viscosity: '5W-30', liters: 3.8 },
          filters: { oil: 'MANN W713/28' },
          total: 3500, masterName: 'Асан Сейткали',
        },
      ],
    }],
  },
  {
    id: 'cl2', name: 'Николай Козлов', phone: '+7 (702) 234-56-78', email: 'n.kozlov@gmail.com',
    visitCount: 3, lastVisit: '2025-05-01', createdAt: '2024-02-20',
    totalSpent: 36000, isRegular: true,
    cars: [{
      id: 'car2', clientId: 'cl2', make: 'BMW', model: '3 Series', year: 2019,
      engineType: 'gasoline', engineVolume: 2.0, licensePlate: 'B456DE', vin: 'WBA8E9G55GNT12345',
      mileage: 78000, lastService: '2025-05-01', nextService: '2025-07-01',
      serviceHistory: [
        {
          id: 'h3', date: '2025-05-01', mileage: 78000,
          services: ['Замена масла двигателя', 'Замена масла АКПП', 'Замена салонного фильтра'],
          oil: { brand: 'Liqui Moly', viscosity: '5W-30', liters: 5.5 },
          filters: { oil: 'MANN W7032', cabin: 'MANN CU2360' },
          total: 18000, masterName: 'Игорь Петренко',
        },
      ],
    }],
  },
  {
    id: 'cl3', name: 'Гульнара Абенова', phone: '+7 (707) 345-67-89',
    visitCount: 2, lastVisit: '2025-03-15', createdAt: '2024-06-10',
    totalSpent: 8500, isRegular: false,
    cars: [{
      id: 'car3', clientId: 'cl3', make: 'Hyundai', model: 'Creta', year: 2021,
      engineType: 'gasoline', engineVolume: 2.0, licensePlate: 'C789GH',
      mileage: 45000, lastService: '2025-03-15', nextService: '2025-06-15',
      serviceHistory: [],
    }],
  },
  {
    id: 'cl4', name: 'Арман Сейткали', phone: '+7 (747) 456-78-90', email: 'arman@kz.kz',
    visitCount: 4, lastVisit: '2025-04-05', createdAt: '2023-08-22',
    totalSpent: 18000, isRegular: true,
    cars: [{
      id: 'car4', clientId: 'cl4', make: 'Nissan', model: 'Qashqai', year: 2020,
      engineType: 'gasoline', engineVolume: 2.0, licensePlate: 'D012IJ',
      mileage: 62000, lastService: '2025-04-05', nextService: '2025-06-05',
      serviceHistory: [],
    }],
  },
  {
    id: 'cl5', name: 'Светлана Мороз', phone: '+7 (771) 567-89-01',
    visitCount: 1, lastVisit: '2025-05-12', createdAt: '2025-05-12',
    totalSpent: 3500, isRegular: false,
    cars: [{
      id: 'car5', clientId: 'cl5', make: 'Kia', model: 'Sportage', year: 2022,
      engineType: 'gasoline', engineVolume: 2.0, licensePlate: 'E345KL',
      mileage: 32000, lastService: '2025-05-12', nextService: '2025-07-12',
      serviceHistory: [],
    }],
  },
  {
    id: 'cl6', name: 'Марат Жаксыбеков', phone: '+7 (778) 678-90-12', email: 'marat.zh@mail.kz',
    visitCount: 12, lastVisit: '2025-05-14', createdAt: '2022-11-05',
    totalSpent: 58000, isRegular: true, cars: [],
  },
  {
    id: 'cl7', name: 'Евгений Петров', phone: '+7 (701) 789-01-23',
    visitCount: 5, lastVisit: '2025-05-10', createdAt: '2023-05-20',
    totalSpent: 22000, isRegular: true, cars: [],
  },
  {
    id: 'cl8', name: 'Айгерим Нурланова', phone: '+7 (702) 890-12-34', email: 'aig@gmail.com',
    visitCount: 6, lastVisit: '2025-04-28', createdAt: '2023-03-01',
    totalSpent: 31000, isRegular: true, cars: [],
  },
  {
    id: 'cl9', name: 'Дмитрий Смирнов', phone: '+7 (707) 901-23-45',
    visitCount: 9, lastVisit: '2025-05-14', createdAt: '2022-07-14',
    totalSpent: 47000, isRegular: true, cars: [],
  },
  {
    id: 'cl10', name: 'Людмила Морозова', phone: '+7 (747) 012-34-56', email: 'l.morozova@mail.kz',
    visitCount: 7, lastVisit: '2025-05-02', createdAt: '2023-02-18',
    totalSpent: 38000, isRegular: true, cars: [],
  },
]

export const TODAY = '2025-05-15'

export const APPOINTMENTS: Appointment[] = [
  {
    id: 'apt1', date: '2025-05-15', time: '09:00',
    clientName: 'Алексей Иванов', clientPhone: '+7 (701) 123-45-67',
    carMake: 'Toyota', carModel: 'Corolla', carYear: 2018, licensePlate: 'A123BC',
    engineType: 'Бензин', engineVolume: 1.6, mileage: 95000,
    services: ['Замена масла двигателя', 'Замена воздушного фильтра'],
    oilPreference: 'Shell Helix HX8 5W-30',
    status: 'completed', masterId: 'm1', total: 5000,
    createdAt: '2025-05-10T10:00:00Z',
  },
  {
    id: 'apt2', date: '2025-05-15', time: '10:00',
    clientName: 'Гульнара Абенова', clientPhone: '+7 (707) 345-67-89',
    carMake: 'Hyundai', carModel: 'Creta', carYear: 2021, licensePlate: 'C789GH',
    engineType: 'Бензин', engineVolume: 2.0, mileage: 45000,
    services: ['Замена масла двигателя', 'Замена салонного фильтра'],
    oilPreference: 'Подберет сервис',
    status: 'in_progress', masterId: 'm2',
    createdAt: '2025-05-12T14:00:00Z',
  },
  {
    id: 'apt3', date: '2025-05-15', time: '11:00',
    clientName: 'Таксопарк Express', clientPhone: '+7 (701) 111-22-33',
    carMake: 'Toyota', carModel: 'Camry', carYear: 2021, licensePlate: '123ABC01',
    engineType: 'Бензин', engineVolume: 2.5, mileage: 125000,
    services: ['Замена масла двигателя', 'Замена воздушного фильтра', 'Замена салонного фильтра'],
    oilPreference: 'Shell Helix HX8 5W-30',
    status: 'confirmed', masterId: 'm1', corporateId: 'corp1',
    createdAt: '2025-05-13T09:00:00Z',
  },
  {
    id: 'apt4', date: '2025-05-15', time: '13:00',
    clientName: 'Арман Сейткали', clientPhone: '+7 (747) 456-78-90',
    carMake: 'Nissan', carModel: 'Qashqai', carYear: 2020, licensePlate: 'D012IJ',
    engineType: 'Бензин', engineVolume: 2.0, mileage: 62000,
    services: ['Заправка кондиционера'],
    oilPreference: 'Не требуется',
    status: 'pending',
    createdAt: '2025-05-14T16:00:00Z',
  },
  {
    id: 'apt5', date: '2025-05-15', time: '14:00',
    clientName: 'Светлана Мороз', clientPhone: '+7 (771) 567-89-01',
    carMake: 'Kia', carModel: 'Sportage', carYear: 2022, licensePlate: 'E345KL',
    engineType: 'Бензин', engineVolume: 2.0, mileage: 32000,
    services: ['Замена масла двигателя'],
    oilPreference: 'Mobil 1 5W-40',
    status: 'pending', masterId: 'm3',
    createdAt: '2025-05-14T11:00:00Z',
  },
  {
    id: 'apt6', date: '2025-05-15', time: '15:00',
    clientName: 'Николай Козлов', clientPhone: '+7 (702) 234-56-78',
    carMake: 'BMW', carModel: '3 Series', carYear: 2019, licensePlate: 'B456DE',
    engineType: 'Бензин', engineVolume: 2.0, mileage: 78000,
    services: ['Замена масла двигателя', 'Замена масла АКПП'],
    oilPreference: 'Liqui Moly 5W-30',
    status: 'pending', masterId: 'm2',
    createdAt: '2025-05-13T15:00:00Z',
  },
  {
    id: 'apt7', date: '2025-05-14', time: '09:00',
    clientName: 'Марат Жаксыбеков', clientPhone: '+7 (778) 678-90-12',
    carMake: 'Toyota', carModel: 'Land Cruiser', carYear: 2020, licensePlate: 'F678MN',
    engineType: 'Дизель', engineVolume: 4.5, mileage: 112000,
    services: ['Замена масла двигателя', 'Замена масла в редукторе'],
    oilPreference: 'Castrol EDGE 5W-40',
    status: 'completed', masterId: 'm1', total: 8000,
    createdAt: '2025-05-10T10:00:00Z',
  },
  {
    id: 'apt8', date: '2025-05-14', time: '11:00',
    clientName: 'Евгений Петров', clientPhone: '+7 (701) 789-01-23',
    carMake: 'Volkswagen', carModel: 'Polo', carYear: 2018, licensePlate: 'G901OP',
    engineType: 'Бензин', engineVolume: 1.6, mileage: 88000,
    services: ['Замена масла двигателя', 'Замена воздушного фильтра', 'Замена салонного фильтра'],
    oilPreference: 'Shell Helix HX8 5W-30',
    status: 'completed', masterId: 'm3', total: 6500,
    createdAt: '2025-05-11T10:00:00Z',
  },
  {
    id: 'apt9', date: '2025-05-14', time: '14:00',
    clientName: 'Айгерим Нурланова', clientPhone: '+7 (702) 890-12-34',
    carMake: 'Hyundai', carModel: 'Tucson', carYear: 2021, licensePlate: 'H234QR',
    engineType: 'Бензин', engineVolume: 2.0, mileage: 55000,
    services: ['Замена масла двигателя'],
    oilPreference: 'Подберет сервис',
    status: 'completed', masterId: 'm1', total: 3500,
    createdAt: '2025-05-12T10:00:00Z',
  },
  {
    id: 'apt10', date: '2025-05-16', time: '09:00',
    clientName: 'Дмитрий Смирнов', clientPhone: '+7 (707) 901-23-45',
    carMake: 'Lada', carModel: 'Vesta', carYear: 2022, licensePlate: 'I567ST',
    engineType: 'Бензин', engineVolume: 1.6, mileage: 42000,
    services: ['Замена масла двигателя', 'Замена топливного фильтра'],
    oilPreference: 'Подберет сервис',
    status: 'confirmed',
    createdAt: '2025-05-14T10:00:00Z',
  },
  {
    id: 'apt11', date: '2025-05-16', time: '11:00',
    clientName: 'Людмила Морозова', clientPhone: '+7 (747) 012-34-56',
    carMake: 'Kia', carModel: 'Rio', carYear: 2020, licensePlate: 'J890UV',
    engineType: 'Бензин', engineVolume: 1.4, mileage: 73000,
    services: ['Замена масла двигателя', 'Замена салонного фильтра', 'Замена воздушного фильтра'],
    oilPreference: 'Liqui Moly 5W-30',
    status: 'pending',
    createdAt: '2025-05-15T08:00:00Z',
  },
]

export const WAREHOUSE: WarehouseItem[] = [
  { id: 'w1', name: 'Shell Helix HX8 5W-30', category: 'oil', quantity: 48, unit: 'л', minQuantity: 20, price: 2800, brand: 'Shell' },
  { id: 'w2', name: 'Mobil 1 5W-40', category: 'oil', quantity: 32, unit: 'л', minQuantity: 20, price: 3200, brand: 'Mobil' },
  { id: 'w3', name: 'Castrol EDGE 5W-30', category: 'oil', quantity: 16, unit: 'л', minQuantity: 20, price: 3000, brand: 'Castrol' },
  { id: 'w4', name: 'Liqui Moly 5W-40', category: 'oil', quantity: 8, unit: 'л', minQuantity: 20, price: 3500, brand: 'Liqui Moly' },
  { id: 'w5', name: 'Shell ATF SP-IV (АКПП)', category: 'oil', quantity: 24, unit: 'л', minQuantity: 10, price: 4500, brand: 'Shell' },
  { id: 'w6', name: 'MANN W712/95 (масляный)', category: 'filter', quantity: 25, unit: 'шт', minQuantity: 15, price: 850, brand: 'MANN' },
  { id: 'w7', name: 'MANN C25114/1 (воздушный)', category: 'filter', quantity: 18, unit: 'шт', minQuantity: 10, price: 1200, brand: 'MANN' },
  { id: 'w8', name: 'MANN CU2939 (салонный)', category: 'filter', quantity: 12, unit: 'шт', minQuantity: 10, price: 950, brand: 'MANN' },
  { id: 'w9', name: 'FILTRON PP 988 (топливный)', category: 'filter', quantity: 8, unit: 'шт', minQuantity: 10, price: 1800, brand: 'FILTRON' },
  { id: 'w10', name: 'Knecht OC 123 (масляный)', category: 'filter', quantity: 20, unit: 'шт', minQuantity: 10, price: 750, brand: 'Knecht' },
  { id: 'w11', name: 'Антифриз G11 Green', category: 'antifreeze', quantity: 60, unit: 'л', minQuantity: 30, price: 450, brand: 'FELIX' },
  { id: 'w12', name: 'Антифриз G12+ Red', category: 'antifreeze', quantity: 40, unit: 'л', minQuantity: 20, price: 550, brand: 'FELIX' },
  { id: 'w13', name: 'Фреон R134a', category: 'freon', quantity: 15, unit: 'кг', minQuantity: 5, price: 3500, brand: 'Dupont' },
  { id: 'w14', name: 'Фреон R1234yf', category: 'freon', quantity: 3, unit: 'кг', minQuantity: 3, price: 8500, brand: 'Honeywell' },
  { id: 'w15', name: 'Тормозная жидкость DOT 4', category: 'brake_fluid', quantity: 12, unit: 'л', minQuantity: 5, price: 650, brand: 'LIQUI MOLY' },
]

export const ANALYTICS = {
  weeklyRevenue: [
    { day: 'Пн', revenue: 45000, orders: 8 },
    { day: 'Вт', revenue: 52000, orders: 10 },
    { day: 'Ср', revenue: 38000, orders: 7 },
    { day: 'Чт', revenue: 61000, orders: 12 },
    { day: 'Пт', revenue: 73000, orders: 14 },
    { day: 'Сб', revenue: 89000, orders: 17 },
    { day: 'Вс', revenue: 31000, orders: 6 },
  ],
  monthlyRevenue: [
    { month: 'Янв', revenue: 420000 },
    { month: 'Фев', revenue: 380000 },
    { month: 'Мар', revenue: 490000 },
    { month: 'Апр', revenue: 520000 },
    { month: 'Май', revenue: 312000 },
  ],
  popularServices: [
    { name: 'Замена масла двигателя', count: 185, percent: 45 },
    { name: 'Замена воздушного фильтра', count: 82, percent: 20 },
    { name: 'Замена салонного фильтра', count: 61, percent: 15 },
    { name: 'Замена масла АКПП', count: 41, percent: 10 },
    { name: 'Заправка кондиционера', count: 41, percent: 10 },
  ],
  popularMakes: [
    { name: 'Toyota', count: 92 },
    { name: 'Hyundai', count: 71 },
    { name: 'Kia', count: 58 },
    { name: 'Chevrolet', count: 45 },
    { name: 'BMW', count: 38 },
    { name: 'Другие', count: 85 },
  ],
  summary: {
    totalRevenue: 2121000,
    avgCheck: 5350,
    totalClients: 389,
    newClients: 45,
    repeatClients: 344,
    totalOrders: 396,
    oilUsed: 820,
    filtersChanged: 312,
  },
}
