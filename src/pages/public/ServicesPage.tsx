import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { api } from '../../api'

interface Service { id: string; name: string; description: string; price: number; duration: number; isActive: boolean; imageUrl: string }

const SERVICE_IMAGES = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1616711906333-a8ebd9028a71?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1621252179027-94459d278660?w=400&h=240&fit=crop&q=80',
  'https://images.unsplash.com/photo-1545262810-a9b0a2c2e5e6?w=400&h=240&fit=crop&q=80',
]

export default function ServicesPage() {
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    api.getServices().then(d => setServices((d as Service[]).filter(s => s.isActive))).catch(console.error)
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">НАШИ УСЛУГИ</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Garage 56 специализируется на замене масел и фильтров для всех типов автомобилей.
          Работаем быстро, качественно и с гарантией.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {services.map((s, i) => (
          <div key={s.id} className="card overflow-hidden flex flex-col sm:flex-row group hover:border-orange-500/40 transition-all">
            <div className="sm:w-40 flex-shrink-0 overflow-hidden bg-[#1a1a1a] flex items-center justify-center">
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={s.name}
                  className="w-full h-40 sm:h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <img
                  src={SERVICE_IMAGES[i % SERVICE_IMAGES.length]}
                  alt={s.name}
                  className="w-full h-40 sm:h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}
            </div>
            <div className="p-5 flex flex-col justify-between flex-1">
              <div>
                <h3 className="font-semibold text-white mb-2">{s.name}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.description}</p>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3">
                  <span className="text-orange-500 font-bold text-lg">
                    от {s.price.toLocaleString('ru-RU')} ₸
                  </span>
                  <span className="flex items-center gap-1 text-gray-500 text-xs">
                    <Clock size={12} /> {s.duration} мин
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/booking?service=${encodeURIComponent(s.name)}`)}
                  className="flex items-center gap-1 text-orange-500 text-sm font-medium hover:gap-2 transition-all"
                >
                  Записаться <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 card p-6 text-center">
        <h3 className="text-white font-semibold text-lg mb-2">Готовы записаться?</h3>
        <p className="text-gray-400 text-sm mb-4">
          Выберите удобное время и запишитесь онлайн за 2 минуты
        </p>
        <button onClick={() => navigate('/booking')} className="btn-orange">
          Онлайн-запись
        </button>
      </div>
    </div>
  )
}
