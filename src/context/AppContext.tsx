import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type {
  Appointment, Client, CorporateClient, WarehouseItem,
  AppointmentStatus, Employee, Car as CarType,
} from '../types'
import { api } from '../api'

interface AppContextType {
  appointments: Appointment[]
  clients: Client[]
  corporateClients: CorporateClient[]
  warehouse: WarehouseItem[]
  employees: Employee[]
  loading: boolean

  // Appointments
  addAppointment: (apt: Omit<Appointment, 'id' | 'createdAt'>) => Promise<void>
  updateAppointmentStatus: (id: string, status: AppointmentStatus, extra?: Partial<Appointment>) => Promise<void>
  updateAppointment: (id: string, data: Partial<Appointment>) => Promise<void>

  // Corporate
  addCorporate: (data: Omit<CorporateClient, 'id' | 'cars'>) => Promise<void>
  updateCorporate: (id: string, data: Omit<CorporateClient, 'id' | 'cars'>) => Promise<void>
  deleteCorporate: (id: string) => Promise<void>

  // Cars
  addCar: (data: Omit<CarType, 'id' | 'serviceHistory'>) => Promise<void>
  updateCar: (id: string, data: Partial<Omit<CarType, 'serviceHistory'>>) => Promise<void>
  deleteCar: (id: string) => Promise<void>

  // Warehouse
  addWarehouseItem: (data: Omit<WarehouseItem, 'id'>) => Promise<void>
  updateWarehouseItem: (id: string, data: Omit<WarehouseItem, 'id'>) => Promise<void>
  deleteWarehouseItem: (id: string) => Promise<void>

  // Employees
  addEmployee: (data: { name: string; email: string; password: string; role: string; phone?: string; specialization?: string }) => Promise<void>
  updateEmployee: (id: string, data: { name: string; email: string; role: string; phone?: string; specialization?: string; isActive?: boolean; password?: string }) => Promise<void>
  deactivateEmployee: (id: string) => Promise<void>

  refreshData: () => Promise<void>
}

const AppContext = createContext<AppContextType>({} as AppContextType)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [corporateClients, setCorporateClients] = useState<CorporateClient[]>([])
  const [warehouse, setWarehouse] = useState<WarehouseItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const mutating = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setLoading(false)
      return
    }
    try {
      const [apts, cls, corps, wh, emps] = await Promise.all([
        api.getAppointments() as Promise<Appointment[]>,
        api.getClients() as Promise<Client[]>,
        api.getCorporate() as Promise<CorporateClient[]>,
        api.getWarehouse() as Promise<WarehouseItem[]>,
        api.getEmployees() as Promise<Employee[]>,
      ])
      setAppointments(apts)
      setClients(cls)
      setCorporateClients(corps)
      setWarehouse(wh)
      setEmployees(emps)
    } catch (e) {
      console.error('AppContext: failed to load data', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Refresh appointments on tab focus + every 30s
  useEffect(() => {
    const refreshApts = async () => {
      if (!localStorage.getItem('token')) return
      if (mutating.current) return  // Don't overwrite in-flight mutations
      try {
        const apts = await api.getAppointments() as Appointment[]
        if (!mutating.current) setAppointments(apts)  // Double-check after async gap
      } catch (e) { console.error('AppContext: appointments poll failed', e) }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refreshApts() }
    const interval = setInterval(refreshApts, 30000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const refreshData = useCallback(async () => {
    await fetchAll()
  }, [fetchAll])

  // ── Appointments ────────────────────────────────────────────────────────────

  const addAppointment = useCallback(async (apt: Omit<Appointment, 'id' | 'createdAt'>) => {
    const { id } = await api.createAppointment(apt) as { id: string }
    const newApt: Appointment = { ...apt, id, createdAt: new Date().toISOString() }
    setAppointments(prev => [...prev, newApt])
  }, [])

  const updateAppointmentStatus = useCallback(async (
    id: string,
    status: AppointmentStatus,
    extra?: Partial<Appointment>,
  ) => {
    mutating.current = true
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status, ...extra } : a))
    try {
      await api.updateAppointment(Number(id), { status, ...extra })
      const apts = await api.getAppointments() as Appointment[]
      setAppointments(apts)
    } finally {
      mutating.current = false
    }
  }, [])

  const updateAppointment = useCallback(async (id: string, data: Partial<Appointment>) => {
    mutating.current = true
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
    try {
      await api.updateAppointment(Number(id), data)
      if (data.status === 'completed') {
        await fetchAll()  // Refresh clients too — server creates client on completion
      } else {
        const apts = await api.getAppointments() as Appointment[]
        setAppointments(apts)
      }
    } catch (e) {
      // Revert optimistic update — fetch real state from server
      const apts = await api.getAppointments().catch(() => null) as Appointment[] | null
      if (apts) setAppointments(apts)
      throw e  // Re-throw so caller (CompleteModal) can show the error
    } finally {
      mutating.current = false
    }
  }, [fetchAll])

  // ── Corporate ───────────────────────────────────────────────────────────────

  const addCorporate = useCallback(async (data: Omit<CorporateClient, 'id' | 'cars'>) => {
    const { id } = await api.createCorporate(data) as { id: string }
    setCorporateClients(prev => [...prev, { ...data, id, cars: [] }])
  }, [])

  const updateCorporate = useCallback(async (id: string, data: Omit<CorporateClient, 'id' | 'cars'>) => {
    await api.updateCorporate(Number(id), data)
    setCorporateClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
  }, [])

  const deleteCorporate = useCallback(async (id: string) => {
    await api.deleteCorporate(Number(id))
    setCorporateClients(prev => prev.filter(c => c.id !== id))
  }, [])

  // ── Cars ────────────────────────────────────────────────────────────────────

  const addCar = useCallback(async (data: Omit<CarType, 'id' | 'serviceHistory'>) => {
    await api.createCar(data)
    await fetchAll()
  }, [fetchAll])

  const updateCar = useCallback(async (id: string, data: Partial<Omit<CarType, 'serviceHistory'>>) => {
    await api.updateCar(Number(id), data)
    await fetchAll()
  }, [fetchAll])

  const deleteCar = useCallback(async (id: string) => {
    await api.deleteCar(Number(id))
    await fetchAll()
  }, [fetchAll])

  // ── Warehouse ───────────────────────────────────────────────────────────────

  const addWarehouseItem = useCallback(async (data: Omit<WarehouseItem, 'id'>) => {
    const { id } = await api.createWarehouseItem(data) as { id: string }
    setWarehouse(prev => [...prev, { ...data, id }])
  }, [])

  const updateWarehouseItem = useCallback(async (id: string, data: Omit<WarehouseItem, 'id'>) => {
    await api.updateWarehouseItem(Number(id), data)
    setWarehouse(prev => prev.map(w => w.id === id ? { ...w, ...data } : w))
  }, [])

  const deleteWarehouseItem = useCallback(async (id: string) => {
    await api.deleteWarehouseItem(Number(id))
    setWarehouse(prev => prev.filter(w => w.id !== id))
  }, [])

  // ── Employees ───────────────────────────────────────────────────────────────

  const addEmployee = useCallback(async (data: { name: string; email: string; password: string; role: string; phone?: string; specialization?: string }) => {
    const { id } = await api.createEmployee(data) as { id: string }
    const emp: Employee = {
      id,
      name: data.name,
      email: data.email,
      role: data.role as Employee['role'],
      phone: data.phone,
      specialization: data.specialization,
      isActive: true,
    }
    setEmployees(prev => [...prev, emp])
  }, [])

  const updateEmployee = useCallback(async (id: string, data: { name: string; email: string; role: string; phone?: string; specialization?: string; isActive?: boolean; password?: string }) => {
    await api.updateEmployee(Number(id), data)
    setEmployees(prev => prev.map(e => e.id === id ? {
      ...e,
      name: data.name,
      email: data.email,
      role: data.role as Employee['role'],
      phone: data.phone,
      specialization: data.specialization,
      isActive: data.isActive ?? e.isActive,
    } : e))
  }, [])

  const deactivateEmployee = useCallback(async (id: string) => {
    await api.deactivateEmployee(Number(id))
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, isActive: false } : e))
  }, [])

  return (
    <AppContext.Provider value={{
      appointments, clients, corporateClients, warehouse, employees, loading,
      addAppointment, updateAppointmentStatus, updateAppointment,
      addCorporate, updateCorporate, deleteCorporate,
      addCar, updateCar, deleteCar,
      addWarehouseItem, updateWarehouseItem, deleteWarehouseItem,
      addEmployee, updateEmployee, deactivateEmployee,
      refreshData,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
