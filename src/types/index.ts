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
  source?: 'site' | 'telegram';   // where the booking came from (unset = created in the CRM)
}

export interface OilUsage {
  brand: string;
  viscosity: string;
  liters: number;
  pricePerLiter?: number;  // price per liter taken from the warehouse at completion
  cost?: number;           // liters × pricePerLiter
}

export interface CompletedServiceRecord {
  oil?: OilUsage;
  oilFilter?: string;
  airFilter?: string;
  cabinFilter?: string;
  fuelFilter?: string;
  items?: UsedItem[];     // anything else taken from the warehouse (antifreeze, freon, brake fluid, other) —
                           // picked freely at completion, not a fixed template
  antifreeze?: string;    // kept only so records written before `items` existed still render
  freon?: string;
  notes?: string;
  total: number;
  servicePrices?: Record<string, number>;
}

/** One warehouse item used up on a job, recorded at whatever price it had at the time. */
export interface UsedItem {
  name: string;
  category: WarehouseItem['category'];
  brand?: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  cost: number;
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
  year: number;
  engineType: EngineType;
  engineVolume: number;
  licensePlate: string;
  vin?: string;
  mileage: number;
  serviceHistory: ServiceHistoryEntry[];
  lastService?: string;
  nextService?: string;
  isArchived?: boolean;   // "deleted" cars are archived: hidden from lists, history and orders are kept
  archivedAt?: string;
  ownerName?: string;     // set on archive listings
}

export interface ServiceHistoryEntry {
  id: string;
  date: string;
  mileage: number;
  services: string[];
  oil?: OilUsage;
  filters: { oil?: string; air?: string; cabin?: string; fuel?: string };
  items?: UsedItem[];      // other materials used (antifreeze, freon, brake fluid, other)
  antifreeze?: string;
  freon?: string;
  masterNotes?: string;
  total: number;
  masterName: string;
  servicePrices?: Record<string, number>;
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
  archivedCars?: Car[];   // archived cars still count in the company's history, totals and reports
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

// A corporate client asks (via the Telegram bot) to remove a car; only staff can approve
export interface CarDeleteRequest {
  id: string;
  kind: 'delete' | 'restore';   // delete a car from the fleet / restore an archived car
  corporateId: string;
  companyName: string;
  carId: string | null;       // null once the car has been deleted
  carLabel: string;
  licensePlate: string;
  reason: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment: string;
  createdAt: string;
  resolvedAt: string | null;
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
