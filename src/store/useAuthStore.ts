import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  isInitialized: boolean
  initError: string | null
  setUser: (user: User | null) => void
  setInitError: (msg: string | null) => void
  markInitialized: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isInitialized: false,
  initError: null,
  setUser: (user) => set({ user }),
  setInitError: (msg) => set({ initError: msg }),
  markInitialized: () => set({ isInitialized: true }),
}))
