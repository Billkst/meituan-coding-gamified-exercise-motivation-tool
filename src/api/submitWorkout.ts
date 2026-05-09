import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Intensity, Rarity } from '@/types/db'

export interface SubmitWorkoutInput {
  sportId: string
  durationMinutes: number
  intensity: Intensity
}

export type StreakStatus = 'new' | 'continued' | 'same_day'

export interface SubmitWorkoutResult {
  xp_gained: number
  card_drawn: { id: string; rarity: Rarity }
  streak: number
  streak_status: StreakStatus
}

export function useSubmitWorkout() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: SubmitWorkoutInput): Promise<SubmitWorkoutResult> => {
      const { data, error } = await supabase.rpc('submit_workout' as never, {
        p_sport_id: input.sportId,
        p_duration_minutes: input.durationMinutes,
        p_intensity: input.intensity,
      } as never)
      if (error) throw error
      return data as unknown as SubmitWorkoutResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] })
      qc.invalidateQueries({ queryKey: ['user_cards'] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
    },
  })
}
