import { useState, useEffect } from 'react'
import { X, Check, Car, Wrench } from 'lucide-react'
import { api } from '../api'
import { CarFormModal, BrandLogo, ServicePickerModal, type CarData } from './CarFormModal'

const MODAL_KEY = 'g56_modal_shown'

interface Service { id: string; name: string; isActive: boolean; imageUrl?: string }

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  // Ensure starts with 7
  const d = digits.startsWith('7') ? digits : '7' + digits.slice(0, 10)
  const n = d.slice(0, 11)
  if (n.length <= 1) return '+7'
  if (n.length <= 4) return `+7 (${n.slice(1)}`
  if (n.length <= 7) return `+7 (${n.slice(1, 4)}) ${n.slice(4)}`
  if (n.length <= 9) return `+7 (${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7)}`
  return `+7 (${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7, 9)}-${n.slice(9, 11)}`
}

export function isValidKZPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, '')
  // 11 digits, starts with 7, operator code starts with 7 (KZ: 700–799)
  return d.length === 11 && d[0] === '7' && d[1] === '7'
}

export default function BookingModal() {
  const [open, setOpen] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [service, setService] = useState('')
  const [carData, setCarData] = useState<CarData | null>(null)
  const [showCarForm, setShowCarForm] = useState(false)
  const [showServicePicker, setShowServicePicker] = useState(false)
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!sessionStorage.getItem(MODAL_KEY)) {
      const t = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (open && services.length === 0) {
      api.getServices().then(d => setServices((d as Service[]).filter(s => s.isActive))).catch(console.error)
    }
  }, [open])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
    if (phoneError && isValidKZPhone(formatted)) setPhoneError('')
  }

  const handleClose = () => {
    sessionStorage.setItem(MODAL_KEY, '1')
    setOpen(false)
  }

  const handleSubmit = async () => {
    if (!isValidKZPhone(phone)) {
      setPhoneError('Введите корректный казахстанский номер (+7 7XX ...)')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await api.book({
        clientName: name, clientPhone: phone,
        email: email || undefined,
        service: service || undefined,
        comment: message,
        ...(carData ? {
          carMake: carData.make, carModel: carData.model,
          carGeneration: carData.generation, carYear: Number(carData.year),
          engineType: carData.engineType, engineVolume: Number(carData.engineVolume),
          mileage: Number(carData.mileage), licensePlate: carData.licensePlate,
        } : {}),
      })
      if (result?.error) throw new Error(result.error)
      sessionStorage.setItem(MODAL_KEY, '1')
      setSubmitted(true)
    } catch (e: any) {
      setSubmitError('Ошибка отправки. Позвоните нам: +7 (701) 123-45-67')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = name.trim().length > 0 && isValidKZPhone(phone) && agree && carData !== null

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col my-auto sm:max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2a2a2a] flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Запись онлайн</h2>
            <p className="text-gray-500 text-xs mt-0.5">Garage 56 — профессиональный автосервис</p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Заявка принята!</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Мы свяжемся с вами в ближайшее время<br />для подтверждения записи
            </p>
            <button onClick={handleClose} className="btn-orange px-8">Закрыть</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <p className="text-gray-400 text-sm leading-relaxed">
                Оставьте заявку — мы свяжемся с вами и подберём удобное время для визита
              </p>

              {/* Name */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Ваше имя <span className="text-orange-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field"
                  placeholder="Иван"
                  autoComplete="name"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Телефон <span className="text-orange-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={() => {
                    if (phone && !isValidKZPhone(phone)) {
                      setPhoneError('Введите корректный казахстанский номер (+7 7XX ...)')
                    }
                  }}
                  className={`input-field ${phoneError ? 'border-red-500/60' : ''}`}
                  placeholder="+7 (701) 123-45-67"
                  autoComplete="tel"
                />
                {phoneError && <p className="text-red-400 text-xs mt-1">{phoneError}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="example@mail.com"
                  autoComplete="email"
                />
              </div>

              {/* Service */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Интересующая услуга</label>
                {service ? (
                  <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#111] flex items-center gap-2.5">
                    {services.find(s => s.name === service)?.imageUrl ? (
                      <img src={services.find(s => s.name === service)!.imageUrl} alt={service} className="w-8 h-8 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <Wrench size={14} className="text-orange-400" />
                      </div>
                    )}
                    <span className="text-white text-sm font-medium flex-1">{service}</span>
                    <button type="button" onClick={() => setShowServicePicker(true)} className="text-xs text-gray-600 hover:text-orange-400 transition-colors flex-shrink-0">изменить</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowServicePicker(true)}
                    className="input-field w-full flex items-center gap-2.5 text-left"
                  >
                    <Wrench size={15} className="text-gray-600 flex-shrink-0" />
                    <span className="text-gray-600 text-sm">Выберите услугу</span>
                  </button>
                )}
              </div>

              {/* Car */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Автомобиль <span className="text-orange-500">*</span></label>
                {carData ? (
                  <div className="border border-[#2a2a2a] rounded-xl p-3 bg-[#111]">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <BrandLogo brand={carData.make} imageUrl={carData.makeImageUrl} size="sm" />
                      <span className="text-white text-sm font-medium">{carData.make} {carData.model}</span>
                      <button type="button" onClick={() => setShowCarForm(true)} className="ml-auto text-xs text-gray-600 hover:text-orange-400 transition-colors flex-shrink-0">изменить</button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div><span className="text-gray-500">Год: </span><span className="text-gray-300">{carData.year}</span></div>
                      <div><span className="text-gray-500">Двигатель: </span><span className="text-gray-300">{carData.engineType} {carData.engineVolume}л</span></div>
                      <div><span className="text-gray-500">Пробег: </span><span className="text-gray-300">{Number(carData.mileage).toLocaleString()} км</span></div>
                      <div className="col-span-2"><span className="text-gray-500">Гос. номер: </span><span className="text-orange-400 font-medium">{carData.licensePlate}</span></div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCarForm(true)}
                    className="input-field w-full flex items-center gap-2.5 text-left"
                  >
                    <Car size={15} className="text-gray-600 flex-shrink-0" />
                    <span className="text-gray-600 text-sm">Добавить данные автомобиля</span>
                    <span className="text-orange-500 text-xs ml-auto flex-shrink-0">*</span>
                  </button>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Сообщение
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Опишите ваш запрос или вопрос..."
                />
              </div>

              {/* Consent */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                  className="mt-0.5 accent-orange-500 flex-shrink-0"
                />
                <span className="text-xs text-gray-400 leading-relaxed">
                  Я согласен на{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-500 hover:text-orange-400 underline underline-offset-2"
                  >
                    обработку персональных данных
                  </a>
                </span>
              </label>
            </div>

            <div className="px-6 pb-6 pt-2 border-t border-[#2a2a2a] flex-shrink-0">
              {submitError && (
                <p className="text-red-400 text-xs mb-3 text-center">{submitError}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="btn-orange w-full disabled:opacity-40"
              >
                {submitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </>
        )}
      </div>

      {showCarForm && (
        <CarFormModal
          initialData={carData ?? undefined}
          onSave={setCarData}
          onClose={() => setShowCarForm(false)}
        />
      )}

      {showServicePicker && (
        <ServicePickerModal
          onSelect={setService}
          onClose={() => setShowServicePicker(false)}
          zIndex="z-[60]"
        />
      )}
    </div>
  )
}
