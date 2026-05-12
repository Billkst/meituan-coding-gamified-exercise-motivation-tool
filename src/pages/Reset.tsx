// Day 25 — /reset?force=1 route.
//
// Wipes all pulse.* localStorage keys and (when authenticated + RPC exists)
// calls `dev_reset_user` to clear server-side cards / match log / chests
// before redirecting back to /onboarding. Without `?force=1`, shows a
// confirmation page so judges don't blow away state by misclicking.
//
// The Supabase RPC `dev_reset_user` is shipped in Migration 28 but pushing
// the migration is a manual step (see CLAUDE.md WSL2 pooler instructions).
// If the RPC is missing on the target DB the local-only reset still works.

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'

type Phase = 'confirm' | 'running' | 'done' | 'error'

function clearLocalPulseState() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('pulse.'))
    .forEach((k) => localStorage.removeItem(k))
}

export default function Reset() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const initialPhase: Phase = params.get('force') === '1' ? 'running' : 'confirm'
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (phase !== 'running' || startedRef.current) return
    startedRef.current = true
    void doReset()
  }, [phase])

  const doReset = async () => {
    clearLocalPulseState()
    if (userId) {
      try {
        const { error } = await supabase.rpc('dev_reset_user' as never, {
          p_user_id: userId,
        } as never)
        if (error && !/does not exist|404|not found/i.test(error.message)) {
          throw error
        }
      } catch (e) {
        const msg = (e as Error).message ?? String(e)
        // RPC missing is fine — keep going with the local reset.
        if (!/does not exist|not found/i.test(msg)) {
          setErrMsg(msg)
          setPhase('error')
          return
        }
      }
    }
    setPhase('done')
    window.setTimeout(() => navigate('/onboarding', { replace: true }), 600)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-sm w-full text-center">
        <div className="font-display font-black text-3xl text-accent-primary uppercase tracking-tight mb-3">
          PULSE
        </div>
        {phase === 'confirm' && (
          <>
            <div className="font-mono text-xs uppercase tracking-widest text-text-secondary mb-6">
              重置账号本地状态 + 服务端 cards / 金币 / 战绩
            </div>
            <button
              onClick={() => setPhase('running')}
              className="bg-semantic-error text-white font-display font-bold uppercase tracking-wider py-2.5 px-6 rounded-button hover:scale-[1.02] transition-transform"
            >
              确认重置
            </button>
            <button
              onClick={() => navigate('/clash')}
              className="block w-full mt-3 font-mono text-[10px] uppercase tracking-widest text-text-tertiary hover:text-text-secondary"
            >
              取消
            </button>
          </>
        )}
        {phase === 'running' && (
          <div className="font-mono text-xs uppercase tracking-widest text-text-secondary animate-pulse">
            重置中...
          </div>
        )}
        {phase === 'done' && (
          <div className="font-mono text-xs uppercase tracking-widest text-accent-primary">
            ✓ 已重置 — 跳转引导...
          </div>
        )}
        {phase === 'error' && (
          <>
            <div className="font-mono text-xs uppercase tracking-widest text-semantic-error mb-3">
              重置失败
            </div>
            <pre className="font-mono text-[10px] text-text-tertiary text-left bg-bg-tertiary rounded-card p-2 overflow-auto">
              {errMsg}
            </pre>
          </>
        )}
      </div>
    </div>
  )
}
