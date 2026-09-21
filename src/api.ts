import type { CarDeleteRequest, Car } from './types'

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')
export const API_BASE_URL = BASE_URL

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('g56_user')
    const path = window.location.pathname
    if (path.startsWith('/crm') || path.startsWith('/master') || path.startsWith('/corporate')) {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // keep the machine-readable part (e.g. code 'CAR_ARCHIVED' + carId) so the UI can offer a way out
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { code: body.code as string | undefined, data: body })
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: Record<string, unknown> }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Employees
  getEmployees: () => request<unknown[]>('/api/employees'),
  createEmployee: (data: unknown) =>
    request<unknown>('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: number, data: unknown) =>
    request<unknown>(`/api/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivateEmployee: (id: number) =>
    request<unknown>(`/api/employees/${id}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: () => request<unknown[]>('/api/appointments'),
  createAppointment: (data: unknown) =>
    request<unknown>('/api/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id: number, data: unknown) =>
    request<unknown>(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAppointment: (id: number) =>
    request<void>(`/api/appointments/${id}`, { method: 'DELETE' }),

  // Clients
  getClients: (params?: { search?: string; isRegular?: boolean; sort?: string }) => {
    const qs = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
    ).toString() : ''
    return request<unknown[]>('/api/clients' + (qs ? `?${qs}` : ''))
  },
  lookupClients: (q: string) => request<unknown[]>(`/api/clients/lookup?q=${encodeURIComponent(q)}`),
  getClient: (id: string) => request<unknown>(`/api/clients/${id}`),
  createClient: (data: unknown) =>
    request<unknown>('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: unknown) =>
    request<unknown>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteClient: (id: string) =>
    request<void>(`/api/clients/${id}`, { method: 'DELETE' }),
  mergeClients: (targetId: string, sourceId: string) =>
    request<unknown>(`/api/clients/${targetId}/merge`, { method: 'POST', body: JSON.stringify({ sourceId }) }),

  // Corporate clients
  getCorporate: () => request<unknown[]>('/api/corporate'),
  createCorporate: (data: unknown) =>
    request<unknown>('/api/corporate', { method: 'POST', body: JSON.stringify(data) }),
  updateCorporate: (id: number, data: unknown) =>
    request<unknown>(`/api/corporate/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCorporate: (id: number) =>
    request<void>(`/api/corporate/${id}`, { method: 'DELETE' }),
  // "New bookings" notification: site / Telegram bookings since the employee last opened the Appointments page
  getNewAppointments: () => request<{
    count: number
    items: { id: string; source: 'site' | 'telegram'; clientName: string; car: string; licensePlate: string; date: string; time: string }[]
  }>('/api/appointments/new'),
  markAppointmentsSeen: () => request<void>('/api/appointments/seen', { method: 'POST' }),

  // "New clients" badge: clients added since the employee last opened the Clients page
  getNewClients: () => request<{ count: number; ids: string[] }>('/api/clients/new'),
  markClientsSeen: () => request<void>('/api/clients/seen', { method: 'POST' }),

  // Requests from corporate clients (Telegram bot): delete a car / restore an archived car
  getCarDeleteRequests: (status: 'pending' | 'all' = 'pending') =>
    request<CarDeleteRequest[]>(`/api/car-delete-requests?status=${status}`),
  approveCarDeleteRequest: (id: string) =>
    request<void>(`/api/car-delete-requests/${id}/approve`, { method: 'POST' }),
  rejectCarDeleteRequest: (id: string, comment: string) =>
    request<void>(`/api/car-delete-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) }),
  getCorporateTelegram: (id: string) =>
    request<{
      botUsername: string | null
      code: string | null
      codeExpiresAt: string | null
      link: string | null
      users: { id: string; name: string; username: string; isActive: boolean; createdAt: string }[]
    }>(`/api/corporate/${id}/telegram`),
  createConnectCode: (id: string) =>
    request<{ code: string; expiresAt: string; link: string | null }>(`/api/corporate/${id}/connect-code`, { method: 'POST' }),
  removeTelegramUser: (id: string) =>
    request<void>(`/api/telegram-users/${id}`, { method: 'DELETE' }),

  // Cars
  getCars: () => request<unknown[]>('/api/cars'),
  createCar: (data: unknown) =>
    request<unknown>('/api/cars', { method: 'POST', body: JSON.stringify(data) }),
  updateCar: (id: number, data: unknown) =>
    request<unknown>(`/api/cars/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  // "Delete" moves a car to the archive (nothing is removed from the database)
  deleteCar: (id: number) =>
    request<void>(`/api/cars/${id}`, { method: 'DELETE' }),
  getArchivedCars: () => request<Car[]>('/api/cars?archived=1'),
  restoreCar: (id: number | string) =>
    request<void>(`/api/cars/${id}/restore`, { method: 'POST' }),

  // Warehouse
  getWarehouse: () => request<unknown[]>('/api/warehouse'),
  createWarehouseItem: (data: unknown) =>
    request<unknown>('/api/warehouse', { method: 'POST', body: JSON.stringify(data) }),
  updateWarehouseItem: (id: number, data: unknown) =>
    request<unknown>(`/api/warehouse/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteWarehouseItem: (id: number) =>
    request<void>(`/api/warehouse/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<Record<string, string>>('/api/settings'),
  updateSettings: (data: Record<string, string>) =>
    request<Record<string, string>>('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Analytics
  getAnalytics: (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    const qs = params.toString()
    return request<unknown>('/api/analytics' + (qs ? `?${qs}` : ''))
  },
  getDashboard: (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    const qs = params.toString()
    return request<unknown>('/api/dashboard' + (qs ? `?${qs}` : ''))
  },

  // Public: taken time slots
  getSlots: (date: string) =>
    fetch(`${BASE_URL}/api/slots?date=${date}`).then(r => r.json()) as Promise<string[]>,

  // Public booking (no auth)
  book: (data: Record<string, unknown>) =>
    fetch(`${BASE_URL}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  // Services (GET is public — no token needed)
  getServices: () => fetch(`${BASE_URL}/api/services`).then(r => r.json()) as Promise<unknown[]>,
  getPublicInfo: () => fetch(`${BASE_URL}/api/public-info`).then(r => r.json()) as Promise<Record<string, string>>,
  getWhyBlocks: () => fetch(`${BASE_URL}/api/why-blocks`).then(r => r.json()) as Promise<unknown[]>,

  // Car brands
  getCarBrands: () => fetch(`${BASE_URL}/api/car-brands`).then(r => r.json()) as Promise<{ id: number; name: string; image_url: string | null }[]>,
  createCarBrand: (data: { name: string; imageUrl?: string; sortOrder?: number }) =>
    request<{ id: number }>('/api/car-brands', { method: 'POST', body: JSON.stringify(data) }),
  updateCarBrand: (id: number, data: { name?: string; imageUrl?: string | null; sortOrder?: number }) =>
    request<{ ok: boolean }>(`/api/car-brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCarBrand: (id: number) =>
    request<{ ok: boolean }>(`/api/car-brands/${id}`, { method: 'DELETE' }),
  importCarBrandsZip: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = localStorage.getItem('token')
    return fetch(`${BASE_URL}/api/car-brands/import-zip`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json()) as Promise<{ imported: number; brands: { id: number; name: string; image_url: string }[]; importedModels: number }>
  },

  // Car models
  getCarModels: (brandId: number) =>
    fetch(`${BASE_URL}/api/car-models?brandId=${brandId}`).then(r => r.json()) as Promise<{ id: number; name: string; imageUrl: string | null }[]>,
  createCarModel: (data: { brandId: number; name: string; imageUrl?: string | null }) =>
    request<{ id: number }>('/api/car-models', { method: 'POST', body: JSON.stringify(data) }),
  updateCarModel: (id: number, data: { name?: string; imageUrl?: string | null }) =>
    request<{ ok: boolean }>(`/api/car-models/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCarModel: (id: number) =>
    request<{ ok: boolean }>(`/api/car-models/${id}`, { method: 'DELETE' }),

  // File upload
  uploadFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = localStorage.getItem('token')
    return fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json()) as Promise<{ url: string }>
  },
  createService: (data: unknown) =>
    request<unknown>('/api/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: number, data: unknown) =>
    request<unknown>(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id: number) =>
    request<void>(`/api/services/${id}`, { method: 'DELETE' }),
}
