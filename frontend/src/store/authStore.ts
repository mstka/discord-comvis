/**
 * Auth store — persists JWT in localStorage.
 *
 * Roles
 * -----
 * admin  : full access (data collection, analysis, settings)
 * viewer : read-only (dashboard, graph, member views, PDF)
 * null   : not authenticated → redirect to /login
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'viewer'

interface AuthState {
  token: string | null
  role: Role | null
  login: (token: string, role: Role) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      login: (token, role) => set({ token, role }),
      logout: () => set({ token: null, role: null }),
    }),
    { name: 'comvis-auth' },
  ),
)

/** Returns the current Bearer header value, or empty string. */
export function getAuthHeader(): string {
  const token = useAuthStore.getState().token
  return token ? `Bearer ${token}` : ''
}

export function isAdmin(): boolean {
  return useAuthStore.getState().role === 'admin'
}
