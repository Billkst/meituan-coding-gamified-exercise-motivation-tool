import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useDevStore } from '@/store/useDevStore'
import { useDevDispatch } from '@/api/dev'
import type { DevAction } from '@/api/dev'
import { useTranslation } from '@/lib/i18n'

const ACTIONS: Array<{ action: DevAction; key: string; promptForN?: boolean }> = [
  { action: 'set_streak', key: 'dev.actions.set_streak', promptForN: true },
  { action: 'grant_legendary', key: 'dev.actions.grant_legendary' },
  { action: 'level_up', key: 'dev.actions.level_up' },
  { action: 'break_streak', key: 'dev.actions.break_streak' },
  { action: 'grant_protect', key: 'dev.actions.grant_protect' },
  { action: 'reset_onboarding', key: 'dev.actions.reset_onboarding' },
  { action: 'reset_progress', key: 'dev.actions.reset_progress' },
]

interface ToastState {
  kind: 'success' | 'error'
  text: string
}

export default function DevDrawer() {
  const { t } = useTranslation()
  const { isDevMode, isPanelOpen, togglePanel, disableDevMode } = useDevStore()
  const dispatch = useDevDispatch()
  const [toast, setToast] = useState<ToastState | null>(null)

  if (!isDevMode) return null

  const showToast = (kind: ToastState['kind'], text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 2000)
  }

  const run = async (action: DevAction, promptForN: boolean | undefined) => {
    let params: Record<string, unknown> = {}
    if (promptForN) {
      const raw = window.prompt('N =', '19')
      if (raw == null) return
      const n = parseInt(raw, 10)
      if (isNaN(n)) {
        showToast('error', 'invalid number')
        return
      }
      params = { n }
    }
    if (action === 'reset_progress' && !window.confirm(t('dev.confirm.reset_progress' as never))) return
    try {
      await dispatch.mutateAsync({ action, params })
      showToast('success', `✓ ${action}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('error', `${action}: ${msg}`)
    }
  }

  return (
    <div
      className={
        'fixed bottom-0 left-[240px] right-0 bg-semantic-error/95 backdrop-blur transition-all duration-200 ' +
        (isPanelOpen ? 'h-64' : 'h-0 overflow-hidden')
      }
      style={{ zIndex: 90 }}
    >
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/20">
        <div className="font-display font-bold uppercase text-white tracking-wider">
          {t('dev.title' as never)}
        </div>
        <button onClick={togglePanel} className="text-white p-1 hover:bg-white/10 rounded" aria-label="Close">
          <IconX size={18} />
        </button>
      </header>
      {toast && (
        <div
          className={
            'mx-6 mt-3 px-3 py-2 font-mono text-xs uppercase tracking-widest border-l-2 ' +
            (toast.kind === 'success'
              ? 'bg-white/10 border-white text-white'
              : 'bg-black/30 border-white text-white')
          }
        >
          {toast.text}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 p-6">
        {ACTIONS.map(({ action, key, promptForN }) => (
          <button
            key={action}
            onClick={() => run(action, promptForN)}
            disabled={dispatch.isPending}
            className="bg-bg-primary border border-semantic-error text-semantic-error font-mono uppercase text-xs px-3 py-2 rounded hover:bg-semantic-error hover:text-white transition disabled:opacity-50"
          >
            {t(key as never)}
          </button>
        ))}
        <button
          onClick={disableDevMode}
          className="bg-bg-primary border border-white/30 text-white font-mono uppercase text-xs px-3 py-2 rounded hover:bg-white hover:text-bg-primary transition col-span-2"
        >
          {t('dev.actions.exit' as never)}
        </button>
      </div>
    </div>
  )
}
