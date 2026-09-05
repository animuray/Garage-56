export const MAKES = [
  'BMW', 'Chevrolet', 'Ford', 'Honda', 'Hyundai', 'Kia', 'Lada',
  'Lexus', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan',
  'Renault', 'Skoda', 'Subaru', 'Toyota', 'Volkswagen',
]

export const MODELS_BY_MAKE: Record<string, string[]> = {
  Toyota: ['Camry', 'Corolla', 'Land Cruiser', 'RAV4', 'Prius', 'Highlander', 'Fortuner', 'Venza', 'HiAce'],
  Hyundai: ['Accent', 'Creta', 'Elantra', 'Santa Fe', 'Solaris', 'Sonata', 'Tucson', 'ix35'],
  Kia: ['Cerato', 'K5', 'Rio', 'Sorento', 'Sportage', 'Stinger', 'Ceed', 'Optima'],
  BMW: ['1 Series', '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X6'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'GLE', 'S-Class', 'Sprinter'],
  Volkswagen: ['Golf', 'Jetta', 'Passat', 'Polo', 'Tiguan', 'Touareg'],
  Chevrolet: ['Aveo', 'Captiva', 'Cobalt', 'Cruze', 'Equinox', 'Lacetti', 'Spark'],
  Nissan: ['Juke', 'Murano', 'Pathfinder', 'Patrol', 'Qashqai', 'Sentra', 'Teana', 'X-Trail'],
  Honda: ['Accord', 'City', 'Civic', 'CR-V', 'HR-V', 'Pilot'],
  Ford: ['EcoSport', 'Explorer', 'Focus', 'Fusion', 'Mondeo', 'Ranger'],
  Mazda: ['CX-3', 'CX-5', 'CX-9', 'Mazda3', 'Mazda6'],
  Mitsubishi: ['ASX', 'Eclipse Cross', 'L200', 'Outlander', 'Pajero', 'Space Star'],
  Skoda: ['Fabia', 'Kodiaq', 'Octavia', 'Rapid', 'Superb'],
  Renault: ['Arkana', 'Duster', 'Kaptur', 'Logan', 'Megane', 'Sandero', 'Koleos'],
  Subaru: ['Forester', 'Impreza', 'Legacy', 'Outback', 'XV'],
  Lexus: ['ES', 'GX', 'IS', 'LX', 'NX', 'RX', 'UX'],
  Lada: ['Granta', 'Kalina', 'Largus', 'Priora', 'Vesta', 'XRAY'],
}

export const YEARS = Array.from({ length: 20 }, (_, i) => 2025 - i)

export interface OilRecommendation {
  viscosity: string
  volume: number
  oilType: string
  oilFilter: string
  airFilter?: string
  notes?: string
}

const DB: Record<string, Record<string, Record<string, OilRecommendation>>> = {
  Toyota: {
    Camry: {
      '2.0 (бензин)': { viscosity: '0W-20', volume: 4.4, oilType: 'Синтетическое', oilFilter: 'MANN W68/3', notes: 'Toyota рекомендует 0W-20 или 5W-30' },
      '2.5 (бензин)': { viscosity: '5W-30', volume: 5.3, oilType: 'Синтетическое', oilFilter: 'MANN W712/95', airFilter: 'MANN C25114/1' },
      '3.5 (бензин)': { viscosity: '5W-30', volume: 6.4, oilType: 'Синтетическое', oilFilter: 'MANN W712/95' },
    },
    Corolla: {
      '1.6 (бензин)': { viscosity: '5W-30', volume: 3.8, oilType: 'Синтетическое', oilFilter: 'MANN W713/28', airFilter: 'MANN C24012' },
      '1.8 (бензин)': { viscosity: '5W-30', volume: 4.2, oilType: 'Синтетическое', oilFilter: 'MANN W713/28' },
      '2.0 (бензин)': { viscosity: '0W-20', volume: 4.6, oilType: 'Синтетическое', oilFilter: 'MANN W68/3' },
    },
    'Land Cruiser': {
      '4.5 (дизель)': { viscosity: '5W-40', volume: 9.5, oilType: 'Синтетическое', oilFilter: 'MANN W950/26', notes: 'Масло с допуском CI-4' },
      '4.6 (бензин)': { viscosity: '5W-30', volume: 8.7, oilType: 'Синтетическое', oilFilter: 'MANN W950/26' },
    },
    RAV4: {
      '2.0 (бензин)': { viscosity: '5W-30', volume: 4.4, oilType: 'Синтетическое', oilFilter: 'MANN W68/3' },
      '2.5 (гибрид)': { viscosity: '0W-20', volume: 4.7, oilType: 'Синтетическое', oilFilter: 'MANN W68/3', notes: 'Специальное масло для гибридов' },
    },
  },
  Hyundai: {
    Accent: {
      '1.4 (бензин)': { viscosity: '5W-30', volume: 3.3, oilType: 'Синтетическое', oilFilter: 'Knecht OC 123', airFilter: 'MANN C25137' },
      '1.6 (бензин)': { viscosity: '5W-30', volume: 3.8, oilType: 'Синтетическое', oilFilter: 'Knecht OC 123' },
    },
    Creta: {
      '1.6 (бензин)': { viscosity: '5W-30', volume: 3.8, oilType: 'Синтетическое', oilFilter: 'Knecht OC 123' },
      '2.0 (бензин)': { viscosity: '5W-30', volume: 4.3, oilType: 'Синтетическое', oilFilter: 'MANN HU712/7' },
    },
    Tucson: {
      '2.0 (бензин)': { viscosity: '5W-30', volume: 4.3, oilType: 'Синтетическое', oilFilter: 'MANN HU712/7' },
      '1.6 T-GDi (турбо)': { viscosity: '0W-30', volume: 4.5, oilType: 'Синтетическое', oilFilter: 'MANN HU7009z' },
    },
  },
  Kia: {
    Rio: {
      '1.4 (бензин)': { viscosity: '5W-30', volume: 3.3, oilType: 'Синтетическое', oilFilter: 'MANN W811/80' },
      '1.6 (бензин)': { viscosity: '5W-30', volume: 3.5, oilType: 'Синтетическое', oilFilter: 'MANN W811/80' },
    },
    Sportage: {
      '2.0 (бензин)': { viscosity: '5W-30', volume: 4.3, oilType: 'Синтетическое', oilFilter: 'MANN HU712/7' },
      '2.0 CRDi (дизель)': { viscosity: '5W-30', volume: 5.0, oilType: 'Синтетическое', oilFilter: 'MANN W940/25' },
    },
  },
  BMW: {
    '1 Series': {
      '1.5 (бензин)': { viscosity: '5W-30', volume: 4.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN HU68X', notes: 'Требуется масло BMW Longlife-04' },
      '2.0 (бензин)': { viscosity: '5W-30', volume: 5.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN HU68X', notes: 'Требуется масло BMW Longlife-04' },
      '2.0d (дизель)': { viscosity: '5W-30', volume: 5.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN HU68X' },
    },
    '3 Series': {
      '2.0 (бензин)': { viscosity: '5W-30', volume: 5.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032', notes: 'Требуется масло BMW Longlife-04' },
      '2.0d (дизель)': { viscosity: '5W-30', volume: 6.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '3.0 (бензин)': { viscosity: '5W-30', volume: 7.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
    },
    '5 Series': {
      '2.0 (бензин)': { viscosity: '5W-30', volume: 6.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032', notes: 'Требуется масло BMW Longlife-04' },
      '3.0 (бензин)': { viscosity: '5W-30', volume: 7.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '3.0d (дизель)': { viscosity: '5W-30', volume: 8.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
    },
    '7 Series': {
      '3.0 (бензин)': { viscosity: '5W-30', volume: 7.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032', notes: 'Требуется масло BMW Longlife-04' },
      '4.4 (бензин)': { viscosity: '5W-30', volume: 8.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '3.0d (дизель)': { viscosity: '5W-30', volume: 8.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
    },
    X1: {
      '1.5 (бензин)': { viscosity: '5W-30', volume: 4.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN HU68X', notes: 'Требуется масло BMW Longlife-04' },
      '2.0 (бензин)': { viscosity: '5W-30', volume: 5.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN HU68X' },
      '2.0d (дизель)': { viscosity: '5W-30', volume: 5.7, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN HU68X' },
    },
    X3: {
      '2.0 (бензин)': { viscosity: '5W-30', volume: 5.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032', notes: 'Требуется масло BMW Longlife-04' },
      '3.0 (бензин)': { viscosity: '5W-30', volume: 7.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '2.0d (дизель)': { viscosity: '5W-30', volume: 6.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '3.0d (дизель)': { viscosity: '5W-30', volume: 7.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
    },
    X5: {
      '3.0 (бензин)': { viscosity: '5W-30', volume: 7.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032', notes: 'Требуется масло BMW Longlife-04' },
      '4.4 (бензин)': { viscosity: '5W-30', volume: 8.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '3.0d (дизель)': { viscosity: '5W-30', volume: 8.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '4.0d (дизель)': { viscosity: '5W-30', volume: 9.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
    },
    X6: {
      '3.0 (бензин)': { viscosity: '5W-30', volume: 7.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032', notes: 'Требуется масло BMW Longlife-04' },
      '4.4 (бензин)': { viscosity: '5W-30', volume: 8.5, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
      '3.0d (дизель)': { viscosity: '5W-30', volume: 8.0, oilType: 'Синтетическое (LL-04)', oilFilter: 'MANN W7032' },
    },
  },
  Volkswagen: {
    Polo: {
      '1.6 (бензин)': { viscosity: '5W-40', volume: 3.5, oilType: 'Синтетическое', oilFilter: 'MANN W712/75', notes: 'VW 502.00/505.00' },
    },
    Golf: {
      '1.4 TSI': { viscosity: '5W-40', volume: 4.5, oilType: 'Синтетическое', oilFilter: 'MANN W712/94', notes: 'VW 504.00/507.00' },
      '2.0 TDI': { viscosity: '5W-30', volume: 5.7, oilType: 'Синтетическое (507.00)', oilFilter: 'MANN W7032' },
    },
    Tiguan: {
      '2.0 TSI': { viscosity: '5W-30', volume: 5.7, oilType: 'Синтетическое (504.00)', oilFilter: 'MANN W7032' },
    },
  },
  Nissan: {
    Qashqai: {
      '2.0 (бензин)': { viscosity: '5W-40', volume: 4.2, oilType: 'Синтетическое', oilFilter: 'MANN W920/21' },
    },
    'X-Trail': {
      '2.0 (бензин)': { viscosity: '5W-40', volume: 4.5, oilType: 'Синтетическое', oilFilter: 'MANN W920/21' },
    },
  },
}

export function getEngineSpecs(make: string, model: string): string[] {
  return Object.keys(DB[make]?.[model] || {})
}

export function getRecommendation(make: string, model: string, engine: string): OilRecommendation | null {
  return DB[make]?.[model]?.[engine] ?? null
}
