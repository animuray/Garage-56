export type Role = 'owner' | 'admin' | 'master' | 'corporate';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  masterId?: string;
  corporateId?: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  carMake: string;
  carModel: string;
  carYear: number;
  licensePlate: string;
  engineType: string;
  engineVolume: number;
  mileage: number;
  vin?: string;
  services: string[];
  oilPreference: string;
  comment?: string;
  status: AppointmentStatus;
  masterId?: string;
  corporateId?: string;
  clientId?: string;
  carId?: string;
  serviceRecord?: CompletedServiceRecord;
  total?: number;
  cancelReason?: string;
  createdAt: string;
}

export interface CompletedServiceRecord {
  oil?: { brand: string; viscosity: string; liters: number };
  oilFilter?: string;
  airFilter?: string;
  cabinFilter?: string;
  fuelFilter?: string;
  antifreeze?: string;
  freon?: string;
  notes?: string;
  total: number;
  servicePrices?: Record<string, number>;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  visitCount: number;
  lastVisit?: string;
  firstVisit?: string;
  totalSpent?: number;
  isRegular: boolean;
  notes?: string;
  createdAt: string;
  cars: Car[];
  appointments?: Appointment[];
}

export type EngineType = 'gasoline' | 'diesel' | 'hybrid' | 'electric' | 'gas';

export interface Car {
  id: string;
  clientId?: string;
  corporateId?: string;
  make: string;
  model: string;
  generation?: string;
  year: number;
  engineType: EngineType;
  engineVolume: number;
  licensePlate: string;
  vin?: string;
  mileage: number;
  serviceHistory: ServiceHistoryEntry[];
  lastService?: string;
  nextService?: string;
}

export interface ServiceHistoryEntry {
  id: string;
  date: string;
  mileage: number;
  services: string[];
  oil?: { brand: string; viscosity: string; liters: number };
  filters: { oil?: string; air?: string; cabin?: string; fuel?: string };
  antifreeze?: string;
  freon?: string;
  masterNotes?: string;
  total: number;
  masterName: string;
}

export interface CorporateClient {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  contract?: string;
  comment?: string;
  cars: Car[];
}

export interface WarehouseItem {
  id: string;
  name: string;
  category: 'oil' | 'filter' | 'antifreeze' | 'freon' | 'brake_fluid' | 'other';
  quantity: number;
  unit: string;
  minQuantity: number;
  price: number;
  brand?: string;
}

export interface Master {
  id: string;
  name: string;
  phone: string;
  specialization: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  specialization?: string;
  corporateId?: string;
  isActive: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}
