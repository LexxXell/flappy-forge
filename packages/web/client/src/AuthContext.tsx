import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from './api'
import type { TokenPayload } from './types'

interface AuthState {
  token: string | null
  user: TokenPayload | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(api.getToken)
  const [user, setUser] = useState<TokenPayload | null>(() => {
    const t = api.getToken()
    return t ? api.decodeToken(t) : null
  })

  const logout = useCallback(() => {
    api.clearToken()
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    api.registerUnauthorizedHandler(logout)
  }, [logout])

  const loginFn = useCallback(async (username: string, password: string) => {
    const tok = await api.login(username, password)
    const payload = api.decodeToken(tok)
    if (!payload) throw new Error('Invalid token received')
    api.setToken(tok)
    setToken(tok)
    setUser(payload)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login: loginFn, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
