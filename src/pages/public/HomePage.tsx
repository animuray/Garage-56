import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wrench, CheckCircle, Phone, MapPin, Clock, ChevronRight } from 'lucide-react'
import { api } from '../../api'

interface Service { id: string; name: string; description: string; price: number; imageUrl: string }
interface WhyBlock { id: string; title: string; desc: string; imageUrl: string }
interface SocialLink { id: string; name: string; url: string; iconUrl: string }

const DEFAULT_WHY: WhyBlock[] = [
  { id: '1', title: 'Качественные материалы', desc: 'Только оригинальные масла и фильтры ведущих брендов', imageUrl: '' },
  { id: '2', title: 'Опытные мастера', desc: 'Команда профессионалов с опытом более 10 лет', imageUrl: '' },
  { id: '3', title: 'Честные цены', desc: 'Прозрачное ценообразование без скрытых доплат', imageUrl: '' },
  { id: '4', title: 'Гарантия на работы', desc: 'Предоставляем гарантию на все выполненные работы', imageUrl: '' },
  { id: '5', title: 'Работаем по записи', desc: 'Без очередей. Ваше время — ценность для нас', imageUrl: '' },
  { id: '6', title: 'Современное оборудование', desc: 'Профессиональный инструмент и оборудование', imageUrl: '' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [services, setServices] = useState<Service[]>([])
  const [whyBlocks, setWhyBlocks] = useState<WhyBlock[]>(DEFAULT_WHY)
  const [publicInfo, setPublicInfo] = useState<Record<string, string>>({})

  useEffect(() => {
    api.getServices().then(d => setServices((d as any[]).filter(s => s.isActive))).catch(console.error)
    api.getWhyBlocks().then(d => { if ((d as WhyBlock[]).length) setWhyBlocks(d as WhyBlock[]) }).catch(() => {})
    api.getPublicInfo().then(d => setPublicInfo(d)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [hash, services])

  return (
    <div>
      {/* Hero */}
      <section
        className="relative min-h-[560px] flex items-center"
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.92) 50%, rgba(0,0,0,0.5) 100%), url(https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1400&q=80) center/cover no-repeat',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 text-orange-400 text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
              Профессиональный автосервис
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
              ПРОФЕССИОНАЛЬНАЯ<br />
              <span className="text-orange-500">ЗАМЕНА МАСЛА</span><br />
              И ТЕХНИЧЕСКОЕ<br />ОБСЛУЖИВАНИЕ
            </h1>
            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
              ВАШЕГО АВТОМОБИЛЯ
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => navigate('/booking')} className="btn-orange text-base px-8 py-3.5">
                Онлайн-запись
              </button>
              <button onClick={() => navigate('/services')} className="btn-outline text-base px-8 py-3.5">
                Наши услуги
              </button>
            </div>
            {/* Badges */}
            <div className="flex flex-wrap gap-4 mt-8">
              {[
                { icon: <CheckCircle size={14} />, text: 'Качественные материалы' },
                { icon: <CheckCircle size={14} />, text: 'Опытные мастера' },
                { icon: <CheckCircle size={14} />, text: 'Честные цены' },
                { icon: <CheckCircle size={14} />, text: 'Гарантия на работы' },
                { icon: <CheckCircle size={14} />, text: 'Современное оборудование' },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-1.5 text-gray-300 text-xs">
                  <span className="text-orange-500">{b.icon}</span> {b.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 max-w-7xl mx-auto px-4" id="services">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">НАШИ УСЛУГИ</h2>
          <p className="text-gray-400">Полный спектр услуг по замене масел и фильтров</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map(s => (
            <div key={s.id} className="card overflow-hidden group hover:border-orange-500/50 transition-all flex flex-col">
              {s.imageUrl ? (
                <img src={s.imageUrl} alt={s.name} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-36 bg-[#1a1a1a] flex items-center justify-center">
                  <Wrench size={36} className="text-orange-500 group-hover:scale-110 transition-transform" />
                </div>
              )}
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-semibold text-white mb-1.5 text-sm">{s.name}</h3>
                <p className="text-gray-400 text-xs leading-relaxed mb-3 flex-1">{s.description}</p>
                <button
                  onClick={() => navigate(`/booking?service=${encodeURIComponent(s.name)}`)}
                  className="text-orange-500 text-xs font-medium flex items-center gap-1 hover:gap-2 transition-all"
                >
                  Записаться <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-16 max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">ПОЧЕМУ ВЫБИРАЮТ GARAGE 56</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {whyBlocks.map(b => (
            <div key={b.id} className="card p-5 flex gap-4 items-start">
              {b.imageUrl ? (
                <img src={b.imageUrl} alt={b.title} className="w-12 h-12 object-cover rounded-xl flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wrench size={24} className="text-orange-500" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-white mb-1">{b.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* Contacts */}
      <section className="py-16 max-w-7xl mx-auto px-4" id="contacts">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">КАК НАС НАЙТИ</h2>
        </div>
        {(() => {
          const address = publicInfo.address || 'г. Алматы, ул. Примерная, 56'
          const phone = publicInfo.phone || '+7 (701) 123-45-67'
          const wdOpen = publicInfo.weekday_open || '09:00'
          const wdClose = publicInfo.weekday_close || '19:00'
          const satOpen = publicInfo.sat_open || '09:00'
          const satClose = publicInfo.sat_close || '18:00'
          const sunClosed = publicInfo.sun_closed === 'true'
          const sunOpen = publicInfo.sun_open || '10:00'
          const sunClose = publicInfo.sun_close || '17:00'
          const socialLinks: SocialLink[] = (() => {
            try { return publicInfo.social_links ? JSON.parse(publicInfo.social_links) : [] } catch { return [] }
          })()
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card p-6 space-y-4 order-last md:order-first">
                <div className="flex gap-3">
                  <MapPin className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <div className="text-white font-medium text-sm">Адрес</div>
                    <div className="text-gray-400 text-sm">{address}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Phone className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <div className="text-white font-medium text-sm">Телефон</div>
                    <a href={`tel:${phone.replace(/\D/g, '')}`} className="text-gray-400 text-sm hover:text-orange-500">{phone}</a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <div className="text-white font-medium text-sm">Часы работы</div>
                    <div className="text-gray-400 text-sm">
                      Пн–Пт: {wdOpen}–{wdClose}<br />
                      Сб: {satOpen}–{satClose}<br />
                      {sunClosed ? 'Вс: Выходной' : `Вс: ${sunOpen}–${sunClose}`}
                    </div>
                  </div>
                </div>
                {socialLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {socialLinks.map(link => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 hover:border-orange-500/40 transition-colors">
                        {link.iconUrl
                          ? <img src={link.iconUrl} alt={link.name} className="w-5 h-5 object-contain rounded" />
                          : <span className="w-5 h-5 bg-orange-500/20 rounded flex items-center justify-center text-orange-400 text-xs font-bold">{link.name[0]?.toUpperCase()}</span>}
                        <span className="text-gray-300 text-xs">{link.name}</span>
                      </a>
                    ))}
                  </div>
                )}
                <button onClick={() => navigate('/booking')} className="btn-orange w-full text-center mt-2">
                  Записаться онлайн
                </button>
              </div>
              {/* Yandex Map */}
              <a
                href={`https://yandex.ru/maps/?text=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card overflow-hidden block order-first md:order-last"
                title="Открыть в Яндекс Картах"
              >
                <iframe
                  src={`https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(address)}&z=16&lang=ru_RU`}
                  width="100%"
                  height="260"
                  frameBorder="0"
                  className="w-full h-[260px] pointer-events-none"
                  title="Карта"
                />
              </a>
            </div>
          )
        })()}
      </section>
    </div>
  )
}
