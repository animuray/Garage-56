import { useState } from 'react'
import { Plus, X, Check, UserX, UserCheck, Pencil, Search } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Employee, Role } from '../../types'

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Владелец', admin: 'Администратор', master: 'Мастер', corporate: 'Корп. клиент',
}
const ROLE_COLORS: Record<Role, string> = {
  owner: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  admin: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  master: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  corporate: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
}

interface EmployeeForm {
  name: string
  email: string
  password: string
  role: Role
  phone: string
  specialization: string
}

const EMPTY_FORM: EmployeeForm = {
  name: '', email: '', password: '', role: 'master', phone: '', specialization: '',
}

const FInput = ({ label, value, onChange, placeholder, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean
}) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className="input-field text-sm" />
  </div>
)

function EmployeeModal({
  employee,
  onClose,
  onSave,
}: {
  employee?: Employee
  onClose: () => void
  onSave: (form: EmployeeForm) => Promise<void>
}) {
  const [form, setForm] = useState<EmployeeForm>(
    employee
      ? { name: employee.name, email: employee.email, password: '', role: employee.role, phone: employee.phone ?? '', specialization: employee.specialization ?? '' }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof EmployeeForm) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.email) { setError('Заполните имя и email'); return }
    if (!employee && !form.password) { setError('Укажите пароль'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{employee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <FInput label="Имя" value={form.name} onChange={set('name')} placeholder="Иван Иванов" required />
          <FInput label="Email" type="email" value={form.email} onChange={set('email')} placeholder="ivan@garage56.kz" required />
          <FInput
            label={employee ? 'Новый пароль (оставьте пустым чтобы не менять)' : 'Пароль'}
            type="password" value={form.password} onChange={set('password')}
            placeholder="••••••••" required={!employee}
          />
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Роль <span className="text-red-400">*</span></label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value as Role }))}
              className="input-field text-sm"
            >
              {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => (
                <option key={r} value={r}>{l}</option>
              ))}
            </select>
          </div>
          <FInput label="Телефон" value={form.phone} onChange={set('phone')} placeholder="+7 (701) 000-00-00" />
          <FInput label="Специализация" value={form.specialization} onChange={set('specialization')} placeholder="Замена масла, диагностика..." />
        </div>
        {error && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-outline flex-1">Отмена</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
            <Check size={15} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EmployeesPage() {
  const { employees, addEmployee, updateEmployee, deactivateEmployee } = useApp()
  const [modal, setModal] = useState<'add' | Employee | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')

  const visible = employees.filter(e => {
    if (!showInactive && !e.isActive) return false
    if (!search) return true
    const q = search.toLowerCase()
    return e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.phone || '').toLowerCase().includes(q) ||
      (e.specialization || '').toLowerCase().includes(q)
  })

  const handleSave = async (form: EmployeeForm) => {
    if (modal === 'add') {
      await addEmployee(form)
    } else if (modal) {
      await updateEmployee(modal.id, { ...form, isActive: modal.isActive })
    }
  }

  const handleDeactivate = async (emp: Employee) => {
    if (emp.isActive) {
      await deactivateEmployee(emp.id)
    } else {
      await updateEmployee(emp.id, {
        name: emp.name, email: emp.email, role: emp.role,
        phone: emp.phone, specialization: emp.specialization, isActive: true,
      })
    }
  }

  const activeCount = employees.filter(e => e.isActive).length

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Сотрудники</h1>
          <p className="text-gray-500 text-xs mt-0.5">{activeCount} активных из {employees.length}</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-orange flex items-center gap-2 text-sm">
          <Plus size={15} /> Добавить
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, email, телефону..."
            className="input-field !pl-10 text-sm" />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="px-3 text-gray-400 hover:text-white border border-[#2a2a2a] rounded-lg">
            <X size={16} />
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 mb-4 cursor-pointer w-fit">
        <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
          className="accent-orange-500" />
        <span className="text-xs text-gray-400">Показать неактивных</span>
      </label>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-[#2a2a2a] bg-[#111]">
              <th className="text-left px-4 py-3 font-medium">Сотрудник</th>
              <th className="text-left px-4 py-3 font-medium">Роль</th>
              <th className="text-left px-4 py-3 font-medium">Специализация</th>
              <th className="text-left px-4 py-3 font-medium">Телефон</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(emp => (
              <tr key={emp.id} className={`border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="text-white font-medium">{emp.name}</div>
                  <div className="text-gray-500 text-xs">{emp.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${ROLE_COLORS[emp.role]}`}>
                    {ROLE_LABELS[emp.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {emp.specialization || '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {emp.phone || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${emp.isActive ? 'text-green-400' : 'text-gray-600'}`}>
                    {emp.isActive ? 'Активен' : 'Отключён'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal(emp)}
                      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors"
                      title="Редактировать">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeactivate(emp)}
                      className={`p-1.5 rounded transition-colors ${emp.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                      title={emp.isActive ? 'Деактивировать' : 'Активировать'}>
                      {emp.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-600 py-10">Сотрудников нет</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <EmployeeModal
          employee={modal === 'add' ? undefined : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
