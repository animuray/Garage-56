import { useState, useEffect, type MouseEvent } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Phone, MapPin } from 'lucide-react'
import BookingModal from '../BookingModal'
import { api } from '../../api'

const NAV = [
  { label: 'Главная', to: '/' },
  { label: 'Услуги', to: '/services' },
  { label: 'Онлайн-запись', to: '/booking' },
  { label: 'Контакты', to: '/#contacts' },
]

interface SocialLink { id: string; name: string; url: string; iconUrl: string }
interface PublicInfo { name?: string; address?: string; phone?: string; weekday_open?: string; weekday_close?: string; sat_open?: string; sat_close?: string; sun_open?: string; sun_close?: string; sun_closed?: string; social_links?: string }

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<PublicInfo>({})
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    api.getPublicInfo().then(d => setInfo(d)).catch(() => {})
  }, [])

  const phone = info.phone || '+7 (701) 123-45-67'
  const address = info.address || 'г. Алматы, ул. Примерная 56'
  const weekdayHours = info.weekday_open ? `${info.weekday_open}–${info.weekday_close}` : '09:00–19:00'
  const satHours = info.sat_open ? `${info.sat_open}–${info.sat_close}` : '09:00–18:00'
  const sunClosed = info.sun_closed === 'true'
  const sunHours = sunClosed ? '' : info.sun_open ? `${info.sun_open}–${info.sun_close}` : '10:00–17:00'
  const weekdaySatSame = weekdayHours === satHours
  const hoursStr = weekdaySatSame
    ? `Пн–Сб: ${weekdayHours}${sunHours ? `, Вс: ${sunHours}` : ''}`
    : `Пн–Пт: ${weekdayHours}, Сб: ${satHours}${sunHours ? `, Вс: ${sunHours}` : ''}`
  const phoneHref = `tel:${phone.replace(/\D/g, '').replace(/^/, '+')}`
  const socialLinks: SocialLink[] = (() => {
    try { return info.social_links ? JSON.parse(info.social_links) : [] } catch { return [] }
  })()

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      {location.pathname !== '/privacy' && <BookingModal />}
      {/* Top bar */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-between items-center text-sm text-gray-400">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><MapPin size={14} className="text-orange-500" /> {address}</span>
            <span>{hoursStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone size={14} className="text-orange-500" />
            <a href={phoneHref} className="hover:text-white transition-colors">{phone}</a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-[#141414] border-b border-[#2a2a2a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Garage 56" className="h-10 w-auto rounded-lg" />
            <span className="font-bold text-white text-lg tracking-wide">GARAGE <span className="text-orange-500">56</span></span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map(n => {
              const isActive = n.to === '/'
                ? location.pathname === '/' && !location.hash
                : n.to.includes('#')
                  ? location.pathname === '/' && location.hash === '#' + n.to.split('#')[1]
                  : location.pathname === n.to
              const handleClick = n.to === '/' ? (e: MouseEvent) => {
                e.preventDefault()
                navigate('/')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              } : undefined
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={handleClick}
                  className={`text-sm font-medium transition-colors ${isActive ? 'text-orange-500' : 'text-gray-300 hover:text-white'}`}
                >
                  {n.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/booking')}
              className="hidden md:block btn-orange text-sm px-4 py-2"
            >
              Записаться
            </button>
            <button
              onClick={() => navigate('/login')}
              className="hidden md:block text-gray-400 hover:text-white text-sm transition-colors"
            >
              Войти
            </button>
            {/* Mobile menu */}
            <button onClick={() => setOpen(!open)} className="md:hidden text-gray-300 hover:text-white">
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {open && (
          <div className="md:hidden bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 py-4 flex flex-col gap-3">
            {NAV.map(n => (
              <Link key={n.to} to={n.to} onClick={(e) => {
                setOpen(false)
                if (n.to === '/') {
                  e.preventDefault()
                  navigate('/')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
                className="text-gray-300 hover:text-white py-1 font-medium">{n.label}</Link>
            ))}
            <button onClick={() => { navigate('/booking'); setOpen(false) }}
              className="btn-orange text-sm text-center">Записаться</button>
            <button onClick={() => { navigate('/login'); setOpen(false) }}
              className="text-gray-400 hover:text-white text-sm">Войти в CRM</button>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#141414] border-t border-[#2a2a2a] mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Garage 56" className="h-8 w-auto rounded-md" />
              <span className="font-bold text-white">GARAGE <span className="text-orange-500">56</span></span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Профессиональный автосервис. Специализируемся на замене масел и фильтров всех видов.
            </p>
          </div>
          <div className="md:col-start-3">
            <h4 className="font-semibold text-white mb-3">Контакты</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>📍 {address}</li>
              <li>📞 <a href={phoneHref} className="hover:text-orange-500">{phone}</a></li>
              {socialLinks.map(link => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-orange-500">
                    {link.iconUrl
                      ? <img src={link.iconUrl} alt={link.name} className="w-4 h-4 object-contain rounded inline" />
                      : <span className="w-4 h-4 bg-orange-500/20 rounded inline-flex items-center justify-center text-orange-400 text-xs font-bold">{link.name[0]?.toUpperCase()}</span>}
                    {link.name}
                  </a>
                </li>
              ))}
              <li>🕐 {hoursStr}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#2a2a2a] py-4 text-center text-gray-600 text-xs">
          © 2026 Garage56. Все права защищены.
        </div>
      </footer>
    </div>
  )
}
