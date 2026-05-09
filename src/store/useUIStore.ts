import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'zh' | 'en'

interface UIState {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      lang: 'zh',
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === 'zh' ? 'en' : 'zh' })),
    }),
    { name: 'pulse-ui-store' }
  )
)
