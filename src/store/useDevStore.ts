import { create } from 'zustand'

const SS_KEY = 'pulse_dev'

interface DevState {
  isDevMode: boolean
  isPanelOpen: boolean
  enableDevMode: () => void
  disableDevMode: () => void
  togglePanel: () => void
  closePanel: () => void
}

const initialDevMode = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SS_KEY) === '1'
  } catch {
    return false
  }
}

export const useDevStore = create<DevState>((set) => ({
  isDevMode: initialDevMode(),
  isPanelOpen: false,
  enableDevMode: () => {
    try { sessionStorage.setItem(SS_KEY, '1') } catch { /* ignore */ }
    set({ isDevMode: true })
  },
  disableDevMode: () => {
    try { sessionStorage.removeItem(SS_KEY) } catch { /* ignore */ }
    set({ isDevMode: false, isPanelOpen: false })
  },
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  closePanel: () => set({ isPanelOpen: false }),
}))
