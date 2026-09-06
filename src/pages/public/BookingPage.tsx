import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Check, ChevronRight, ChevronLeft, Wrench, Car } from 'lucide-react'
import { api } from '../../api'
import { formatPhone, isValidKZPhone } from '../../components/BookingModal'
import { CAR_BRANDS, BrandLogo, BrandPickerModal, ModelPickerModal } from '../../components/CarFormModal'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface CarModel { id: number; name: string; imageUrl: string | null }

const fmtDate = (iso: string) => iso ? iso.split('-').reverse().join('.') : ''

const STEPS = ['Дата и время', 'Автомобиль', 'Услуги', 'Контакты']

function generateTimes(open: string, close: string, slotMin: number): string[] {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const times: string[] = []
  for (let m = toMin(open); m < toMin(close); m += slotMin) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return times
}

const ENGINE_TYPES = ['Бензин', 'Электро', 'Газ', 'Дизель', 'Гибрид']

function getDates(daysAhead: number, sunClosed: boolean) {
  const dates: { date: string; label: string; day: string }[] = []
  const nowGMT5 = new Date(Date.now() + 5 * 3600 * 1000)
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(nowGMT5)
    d.setUTCDate(nowGMT5.getUTCDate() + i)
    if (sunClosed && d.getUTCDay() === 0) continue
    const iso = d.toISOString().split('T')[0]
    dates.push({
      date: iso,
      label: i === 0 ? 'Сегодня' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      day: i === 0 ? '' : d.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' }),
    })
  }
  return dates
}

function getAvailableTimes(taken: string[], date: string, times: string[]) {
  const nowGMT5 = new Date(Date.now() + 5 * 3600 * 1000)
  const todayIso = nowGMT5.toISOString().split('T')[0]
  const isToday = date === todayIso
  const nowH = nowGMT5.getUTCHours()
  const nowM = nowGMT5.getUTCMinutes()
  return times.map(t => {
    const [h, m] = t.split(':').map(Number)
    const isPast = isToday && (h < nowH || (h === nowH && m <= nowM))
    return { time: t, taken: taken.includes(t) || isPast }
  })
}

const Input = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1.5 font-medium">{label} {props.required && <span className="text-orange-500">*</span>}</label>
    <input {...props} className="input-field text-center" />
  </div>
)

interface Service { id: string; name: string; price: number; isActive: boolean; imageUrl?: string }

export default function BookingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [services, setServices] = useState<Service[]>([])

  const preselectedService = new URLSearchParams(location.search).get('service') || ''

  const [publicInfo, setPublicInfo] = useState<Record<string, string>>({})
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [takenTimes, setTakenTimes] = useState<string[]>([])
  const [showBrandPicker, setShowBrandPicker] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [carMake, setCarMake] = useState('')
  const [carMakeImageUrl, setCarMakeImageUrl] = useState<string | null>(null)
  const [carMakeId, setCarMakeId] = useState<number | null>(null)
  const [availableModels, setAvailableModels] = useState<CarModel[]>([])
  const [carModel, setCarModel] = useState('')
  const [carModelImageUrl, setCarModelImageUrl] = useState<string | null>(null)
  const [carYear, setCarYear] = useState('')
  const [engineType, setEngineType] = useState('Бензин')
  const [engineVolume, setEngineVolume] = useState('')
  const [mileage, setMileage] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>(preselectedService ? [preselectedService] : [])
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [agree, setAgree] = useState(false)

  useEffect(() => {
    api.getServices().then(d => setServices((d as Service[]).filter(s => s.isActive))).catch(console.error)
    api.getPublicInfo().then(setPublicInfo).catch(console.error)
  }, [])

  useEffect(() => {
    if (!date) { setTakenTimes([]); return }
    api.getSlots(date).then(setTakenTimes).catch(console.error)
  }, [date])

  useEffect(() => {
    if (!carMakeId) { setAvailableModels([]); return }
    fetch(`${API_BASE}/api/car-models?brandId=${carMakeId}`)
      .then(r => r.json())
      .then((d: CarModel[]) => setAvailableModels(Array.isArray(d) ? d : []))
      .catch(() => setAvailableModels([]))
  }, [carMakeId])

  const slotMin = parseInt(publicInfo.slot_duration || '60', 10)
  const daysAhead = parseInt(publicInfo.booking_days_ahead || '14', 10)
  const sunClosed = publicInfo.sun_closed === 'true'

  const getTimesForDate = (d: string) => {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay()
    if (dow === 0) return sunClosed ? [] : generateTimes(publicInfo.sun_open || '09:00', publicInfo.sun_close || '17:00', slotMin)
    if (dow === 6) return generateTimes(publicInfo.sat_open || '09:00', publicInfo.sat_close || '17:00', slotMin)
    return generateTimes(publicInfo.weekday_open || '09:00', publicInfo.weekday_close || '18:00', slotMin)
  }

  const dates = getDates(daysAhead, sunClosed)
  const availableTimes = date ? getAvailableTimes(takenTimes, date, getTimesForDate(date)) : []

  const toggleService = (name: string) => {
    setSelectedServices(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    )
  }

  const canNext = () => {
    if (step === 0) return date && time
    if (step === 1) return carMake && carModel && carYear && engineVolume && mileage && licensePlate
    if (step === 2) return selectedServices.length > 0
    if (step === 3) return clientName && isValidKZPhone(clientPhone) && agree
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.book({
        date, time, clientName, clientPhone,
        carMake, carModel, carYear: Number(carYear),
        licensePlate, engineType,
        engineVolume: Number(engineVolume),
        mileage: Number(mileage),
        services: selectedServices,
      })
      setSubmitted(true)
    } catch {
      // show error inline if needed
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Вы успешно записаны!</h2>
        <p className="text-gray-400 mb-2">
          Запись на <strong className="text-white">{fmtDate(date)}</strong> в <strong className="text-white">{time}</strong>
        </p>
        <p className="text-gray-500 text-sm mb-8">Мы свяжемся с вами для подтверждения записи</p>
        <button onClick={() => navigate('/')} className="btn-orange">На главную</button>
      </div>
    )
  }

  return (
    <>
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white text-center mb-6">ОНЛАЙН-ЗАПИСЬ</h1>

      {/* Steps */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <>
            <div key={s} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? 'bg-orange-500 text-white' :
                i === step ? 'bg-orange-500 text-white ring-2 ring-orange-500/30' :
                'bg-[#2a2a2a] text-gray-500'
              }`}>
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${i === step ? 'text-orange-500' : 'text-gray-600'}`}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 transition-all ${i < step ? 'bg-orange-500' : 'bg-[#2a2a2a]'}`} />
            )}
          </>
        ))}
      </div>

      <div className="card p-6">
        {/* Step 0: Date & Time */}
        {step === 0 && (
          <div>
            <h3 className="font-semibold text-white mb-4">1. Выберите дату и время</h3>
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">Дата</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {dates.slice(0, 14).map(d => (
                  <button
                    key={d.date}
                    onClick={() => { setDate(d.date); setTime('') }}
                    className={`rounded-lg p-2 text-center text-xs transition-colors ${
                      date === d.date
                        ? 'bg-orange-500 text-white border border-orange-500'
                        : 'bg-[#111] border border-[#2a2a2a] text-gray-300 hover:border-[#4a4a4a] hover:text-white'
                    }`}
                  >
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs opacity-70">{d.day}</div>
                  </button>
                ))}
              </div>
            </div>
            {date && (
              <div>
                <p className="text-xs text-gray-400 mb-2 font-medium">Время</p>
                <div className="grid grid-cols-4 gap-2">
                  {availableTimes.map(({ time: t, taken }) => (
                    <button
                      key={t}
                      disabled={taken}
                      onClick={() => setTime(t)}
                      className={`rounded-lg py-2.5 text-sm text-center transition-colors ${
                        taken ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed border border-[#2a2a2a]' :
                        time === t ? 'bg-orange-500 text-white border border-orange-500' :
                        'bg-[#111] border border-[#2a2a2a] text-gray-300 hover:border-[#4a4a4a] hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded inline-block" />Занято</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded inline-block" />Выбрано</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#111] border border-[#2a2a2a] rounded inline-block" />Свободно</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Car */}
        {step === 1 && (
          <div>
            <h3 className="font-semibold text-white mb-4">2. Ваш автомобиль</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Марка <span className="text-orange-500">*</span></label>
                <button
                  type="button"
                  onClick={() => setShowBrandPicker(true)}
                  className="input-field w-full flex items-center justify-center gap-2 text-center"
                >
                  {carMake ? (
                    <>
                      <BrandLogo brand={carMake} imageUrl={carMakeImageUrl} size="sm" />
                      <span className="text-white text-sm">{carMake}</span>
                    </>
                  ) : (
                    <span className="text-gray-600 text-sm">Выберите марку</span>
                  )}
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Модель <span className="text-orange-500">*</span></label>
                {availableModels.length > 0 ? (
                  <button type="button" onClick={() => setShowModelPicker(true)}
                    className="input-field w-full flex items-center gap-2">
                    {carModel ? (
                      <>
                        {carModelImageUrl
                          ? <img src={carModelImageUrl} alt={carModel} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                          : <Car size={14} className="text-gray-500 flex-shrink-0" />}
                        <span className="text-white text-sm">{carModel}</span>
                      </>
                    ) : (
                      <span className="text-gray-600 text-sm">Выберите модель</span>
                    )}
                  </button>
                ) : (
                  <input value={carModel} onChange={e => setCarModel(e.target.value)}
                    className="input-field text-center" placeholder="Выберите модель" />
                )}
              </div>
              <Input label="Год выпуска" required type="text" inputMode="numeric" value={carYear} onChange={e => setCarYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Год выпуска" />
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Тип двигателя <span className="text-orange-500">*</span></label>
                <div className="grid grid-cols-5 gap-1.5">
                  {ENGINE_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setEngineType(t)}
                      className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
                        engineType === t
                          ? 'bg-orange-500 text-white'
                          : 'bg-[#111] border border-[#2a2a2a] text-gray-400 hover:border-orange-500/50'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Объём двигателя (л)" required type="number" step="0.1" value={engineVolume} onChange={e => setEngineVolume(e.target.value)} placeholder="Объём (л)" />
              <Input label="Пробег (км)" required type="number" value={mileage} onChange={e => setMileage(e.target.value)} placeholder="Пробег (км)" />
              <div className="col-span-2">
                <Input label="Гос. номер" required value={licensePlate} onChange={e => setLicensePlate(e.target.value.toUpperCase())} placeholder="Гос. номер" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Services */}
        {step === 2 && (
          <div>
            <h3 className="font-semibold text-white mb-4">3. Выберите услуги</h3>
            <div className="space-y-2">
              {services.map(s => (
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedServices.includes(s.name)
                    ? 'border-orange-500/60 bg-orange-500/10'
                    : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(s.name)}
                    onChange={() => toggleService(s.name)}
                    className="accent-orange-500 flex-shrink-0"
                  />
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <Wrench size={16} className="text-orange-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">от {s.price.toLocaleString('ru-RU')} ₸</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedServices.length === 0 && (
              <p className="text-orange-400 text-xs mt-2">Выберите хотя бы одну услугу</p>
            )}
          </div>
        )}

        {/* Step 3: Contacts */}
        {step === 3 && (
          <div>
            <h3 className="font-semibold text-white mb-4">4. Ваши контакты</h3>
            <div className="space-y-4 mb-4">
              <Input label="Ваше имя" required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="" />
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Телефон <span className="text-orange-500">*</span></label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(formatPhone(e.target.value))}
                  className="input-field"
                  placeholder="+7 (7xx) xxx-xx-xx"
                  autoComplete="tel"
                />
                {clientPhone && !isValidKZPhone(clientPhone) && (
                  <p className="text-red-400 text-xs mt-1">Введите корректный казахстанский номер</p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 mb-4 space-y-3">
              <div className="font-medium text-white text-sm">Итог записи:</div>

              <div className="text-sm">
                <span className="text-gray-500 text-xs">Дата и время</span>
                <div className="text-white mt-0.5">{fmtDate(date)} в {time}</div>
              </div>

              <div>
                <span className="text-gray-500 text-xs">Автомобиль</span>
                <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#0f0f0f] mt-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <BrandLogo brand={carMake} imageUrl={carMakeImageUrl} size="sm" />
                    <span className="text-white text-sm font-medium">{carMake} {carModel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{carYear}</span></div>
                    <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{engineType} {engineVolume}л</span></div>
                    <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{Number(mileage).toLocaleString()} км</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-medium">{licensePlate}</span></div>
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <span className="text-gray-500 text-xs">Услуги</span>
                <div className="text-white mt-0.5">{selectedServices.join(', ')}</div>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agree}
                onChange={e => setAgree(e.target.checked)}
                className="mt-0.5 accent-orange-500"
              />
              <span className="text-xs text-gray-400">
                Я согласен на{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 underline underline-offset-2">
                  обработку персональных данных
                </a>
              </span>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-outline flex items-center gap-2">
              <ChevronLeft size={16} /> Назад
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="btn-orange flex items-center gap-2 disabled:opacity-40"
            >
              Продолжить <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canNext() || submitting}
              className="btn-orange flex items-center gap-2 disabled:opacity-40"
            >
              {submitting ? 'Отправка...' : <><Check size={16} /> Записаться</>}
            </button>
          )}
        </div>
      </div>
    </div>

    {showBrandPicker && (
      <BrandPickerModal
        onSelect={(name, imgUrl, brandId) => { setCarMake(name); setCarMakeImageUrl(imgUrl ?? null); setCarMakeId(brandId ?? null); setCarModel(''); setCarModelImageUrl(null) }}
        onClose={() => setShowBrandPicker(false)}
      />
    )}

    {showModelPicker && carMakeId && (
      <ModelPickerModal
        brandId={carMakeId}
        onSelect={(name, imgUrl) => { setCarModel(name); setCarModelImageUrl(imgUrl ?? null) }}
        onClose={() => setShowModelPicker(false)}
      />
    )}
    </>
  )
}
