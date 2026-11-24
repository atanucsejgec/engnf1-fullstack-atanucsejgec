import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // "checking" = we have a saved token and are asking /auth/me if it's still valid
  const [checking, setChecking] = useState(Boolean(tokenStore.get()))

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) return
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => logout())
      .finally(() => setChecking(false))
  }, [logout])

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password })
    tokenStore.set(data.token)
    setUser(data.user)
    return data.user
  }

  async function register(name, email, password) {
    await api.post('/auth/register', { name, email, password })
    return login(email, password)
  }

  const value = { user, checking, isAdmin: user?.role === 'ADMIN', login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
