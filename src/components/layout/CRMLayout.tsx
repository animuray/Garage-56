import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, Car, Building2,
  Package, BarChart3, Settings, LogOut, Menu, Wrench, UserCog, Bell, BellOff,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../api'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const { publicKey } = await fetch(`${API_BASE}/api/push/vapid-key`).then(r => r.json())
    if (!publicKey) return
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await sendSub(existing)
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    await sendSub(sub)
  } catch (e) { console.error('push register:', e) }
}

async function sendSub(sub: PushSubscription) {
  const token = localStorage.getItem('token')
  await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(sub.toJSON()),
  })
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

interface NavItem { label: string; to: string; icon: React.ReactNode; roles?: string[] }

const NAV_ITEMS: NavItem[] = [
  { label: 'Дашборд', to: '/crm/dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'owner'] },
  { label: 'Записи', to: '/crm/appointments', icon: <Calendar size={18} />, roles: ['admin', 'owner'] },
  { label: 'Клиенты', to: '/crm/clients', icon: <Users size={18} />, roles: ['admin', 'owner'] },
  { label: 'Автомобили', to: '/crm/cars', icon: <Car size={18} />, roles: ['admin', 'owner'] },
  { label: 'Корп. клиенты', to: '/crm/corporate', icon: <Building2 size={18} />, roles: ['admin', 'owner'] },
  { label: 'Склад', to: '/crm/warehouse', icon: <Package size={18} />, roles: ['admin', 'owner'] },
  { label: 'Аналитика', to: '/crm/analytics', icon: <BarChart3 size={18} />, roles: ['admin', 'owner'] },
  { label: 'Сотрудники', to: '/crm/employees', icon: <UserCog size={18} />, roles: ['admin', 'owner'] },
  { label: 'Услуги', to: '/crm/services', icon: <Wrench size={18} />, roles: ['admin', 'owner'] },
  { label: 'Мои записи', to: '/master', icon: <Wrench size={18} />, roles: ['master'] },
  { label: 'Мои автомобили', to: '/corporate', icon: <Building2 size={18} />, roles: ['corporate'] },
  { label: 'Настройки', to: '/crm/settings', icon: <Settings size={18} />, roles: ['admin', 'owner'] },
]

export default function CRMLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [notifState, setNotifState] = useState<'default' | 'granted' | 'denied'>('default')

  useEffect(() => {
    api.getPublicInfo().then(d => setServiceName(d.name || '')).catch(() => {})
  }, [])

  useEffect(() => {
    if (!('Notification' in window)) return
    setNotifState(Notification.permission as 'default' | 'granted' | 'denied')
    if (Notification.permission === 'granted') {
      registerPush()
    }
  }, [])

  const handleEnableNotif = async () => {
    await registerPush()
    if ('Notification' in window) setNotifState(Notification.permission as 'default' | 'granted' | 'denied')
  }

  const homeRoute = user?.role === 'master' ? '/master' : user?.role === 'corporate' ? '/corporate' : '/crm/dashboard'
  const visibleNav = NAV_ITEMS.filter(n => !n.roles || (user && n.roles.includes(user.role)))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#2a2a2a]">
        <img src="/logo.png" alt="Garage 56" className="h-8 w-auto rounded-md" />
        <span className="font-bold text-white text-sm tracking-wide">GARAGE <span className="text-orange-500">56</span></span>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="text-xs text-gray-500 mb-0.5">
          {{ owner: 'Владелец', admin: 'Администратор', master: 'Мастер', corporate: 'Корп. клиент' }[user?.role ?? 'admin']}
        </div>
        <div className="text-sm font-medium text-white truncate">{user?.name}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              isActive ? 'sidebar-link-active' : 'sidebar-link'
            }
          >
            {item.icon}
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Notifications + Logout */}
      <div className="px-3 py-3 border-t border-[#2a2a2a] space-y-1">
        {notifState !== 'denied' && (
          <button
            onClick={handleEnableNotif}
            className={`sidebar-link w-full ${notifState === 'granted' ? 'text-orange-400 hover:text-orange-300' : 'text-gray-400 hover:text-white'}`}
          >
            {notifState === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
            <span className="text-sm">{notifState === 'granted' ? 'Уведомления вкл.' : 'Включить уведомления'}</span>
          </button>
        )}
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <LogOut size={18} />
          <span className="text-sm">Выйти</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0f0f0f] overflow-hidden">
      {/* Desktop sidebar — hidden for master */}
      {user?.role !== 'master' && (
        <aside className="hidden md:flex w-56 bg-[#141414] border-r border-[#2a2a2a] flex-col flex-shrink-0">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile sidebar overlay — hidden for master */}
      {sidebarOpen && user?.role !== 'master' && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-56 bg-[#141414] border-r border-[#2a2a2a] flex flex-col">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header — hidden for master (master page has its own header) */}
        <div className={`${user?.role === 'master' ? 'hidden' : 'md:hidden'} flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a] bg-[#141414] flex-shrink-0`}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu size={20} />
          </button>
          <button
            onClick={() => navigate(homeRoute)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
          >
            <img src="/logo.png" alt="logo" className="h-7 w-auto rounded" />
            {serviceName && (
              <span className="font-bold text-white text-sm tracking-wide">{serviceName}</span>
            )}
          </button>
          {notifState !== 'denied' && (
            <button
              onClick={handleEnableNotif}
              title={notifState === 'granted' ? 'Уведомления включены' : 'Включить уведомления'}
              className={`p-1.5 rounded-lg transition-colors ${notifState === 'granted' ? 'text-orange-400' : 'text-gray-500 hover:text-white'}`}
            >
              {notifState === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
          )}
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
