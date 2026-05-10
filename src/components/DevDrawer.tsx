import { useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useDevStore } from '@/store/useDevStore'
import { useDevDispatch } from '@/api/dev'
import type { DevAction } from '@/api/dev'
import { useTranslation } from '@/lib/i18n'

interface ActionDef {
  action: DevAction
  key: string
  promptForN?: boolean
  paramKey?: string
  confirm?: string
  group?: 'core' | 'clash'
}

const ACTIONS: ActionDef[] = [
  { action: 'set_streak', key: 'dev.actions.set_streak', promptForN: true, paramKey: 'n' },
  { action: 'grant_legendary', key: 'dev.actions.grant_legendary' },
  { action: 'level_up', key: 'dev.actions.level_up' },
  { action: 'break_streak', key: 'dev.actions.break_streak' },
  { action: 'grant_protect', key: 'dev.actions.grant_protect' },
  { action: 'reset_onboarding', key: 'dev.actions.reset_onboarding' },
  { action: 'reset_progress', key: 'dev.actions.reset_progress', confirm: 'dev.confirm.reset_progress' },
  { action: 'grant_gold', key: 'dev.actions.grant_gold', promptForN: true, paramKey: 'amount', group: 'clash' },
  { action: 'unlock_all_cr_cards', key: 'dev.actions.unlock_all_cr_cards', group: 'clash' },
  { action: 'instant_open_chests', key: 'dev.actions.instant_open_chests', group: 'clash' },
  { action: 'reset_clash', key: 'dev.actions.reset_clash', confirm: 'dev.confirm.reset_clash', group: 'clash' },
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

  const run = async (def: ActionDef) => {
    let params: Record<string, unknown> = {}
    if (def.promptForN) {
      const defaultValue = def.paramKey === 'amount' ? '1000' : '19'
      const raw = window.prompt(`${def.paramKey ?? 'N'} =`, defaultValue)
      if (raw == null) return
      const n = parseInt(raw, 10)
      if (isNaN(n)) {
        showToast('error', 'invalid number')
        return
      }
      params = { [def.paramKey ?? 'n']: n }
    }
    if (def.confirm && !window.confirm(t(def.confirm as never))) return
    try {
      await dispatch.mutateAsync({ action: def.action, params })
      showToast('success', `✓ ${def.action}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('error', `${def.action}: ${msg}`)
    }
  }

  return (
    <div
      className={
        'fixed bottom-0 left-[240px] right-0 bg-semantic-error/95 backdrop-blur transition-all duration-200 ' +
        (isPanelOpen ? 'h-[28rem]' : 'h-0 overflow-hidden')
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
      <div className="overflow-y-auto h-[calc(100%-3.5rem)] px-6 py-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/70 mb-2">
          {t('dev.section.core' as never)}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {ACTIONS.filter((a) => a.group !== 'clash').map((def) => (
            <button
              key={def.action}
              onClick={() => run(def)}
              disabled={dispatch.isPending}
              className="bg-bg-primary border border-semantic-error text-semantic-error font-mono uppercase text-xs px-3 py-2 rounded hover:bg-semantic-error hover:text-white transition disabled:opacity-50"
            >
              {t(def.key as never)}
            </button>
          ))}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/70 mb-2">
          {t('dev.section.clash' as never)}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {ACTIONS.filter((a) => a.group === 'clash').map((def) => (
            <button
              key={def.action}
              onClick={() => run(def)}
              disabled={dispatch.isPending}
              className="bg-bg-primary border border-accent-primary text-accent-primary font-mono uppercase text-xs px-3 py-2 rounded hover:bg-accent-primary hover:text-bg-primary transition disabled:opacity-50"
            >
              {t(def.key as never)}
            </button>
          ))}
        </div>
        <button
          onClick={disableDevMode}
          className="w-full bg-bg-primary border border-white/30 text-white font-mono uppercase text-xs px-3 py-2 rounded hover:bg-white hover:text-bg-primary transition"
        >
          {t('dev.actions.exit' as never)}
        </button>
      </div>
    </div>
  )
}
