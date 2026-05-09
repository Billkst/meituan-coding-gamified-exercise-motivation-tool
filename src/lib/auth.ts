import { supabase } from './supabase'
import { useAuthStore } from '@/store/useAuthStore'

let initPromise: Promise<void> | null = null

export function initAuth(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setUser(session?.user ?? null)
    })

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        useAuthStore.getState().setUser(session.user)
      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) throw error
        useAuthStore.getState().setUser(data.user)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      useAuthStore.getState().setInitError(msg)
    } finally {
      useAuthStore.getState().markInitialized()
    }
  })()
  return initPromise
}
