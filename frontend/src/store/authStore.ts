import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useGameStore } from './gameStore'
import { clearSession } from '../utils/session'

export interface User {
  id: string
  username: string
  display_name?: string | null
  total_score: number
  created_at: string
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        useGameStore.getState().reset()
        clearSession()
        localStorage.setItem('hayawanat_guest_uuid', crypto.randomUUID())
        set({ token: null, user: null })
        window.location.assign('/')
      },
    }),
    {
      name: 'auth_storage',
    }
  )
)
