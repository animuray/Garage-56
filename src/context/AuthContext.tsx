import React, { createContext, useContext, useState, useCallback } from 'react'
import type { User, Role } from '../types'
import { api } from '../api'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('g56_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { token, user: u } = await api.login(email, password)
      const userData: User = {
        id: String(u.id),
        name: u.name as string,
        email: u.email as string,
        role: u.role as Role,
        masterId: u.masterId as string | undefined,
        corporateId: u.corporateId as string | undefined,
      }
      localStorage.setItem('token', token)
      localStorage.setItem('g56_user', JSON.stringify(userData))
      setUser(userData)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('g56_user')
    localStorage.removeItem('token')
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
