import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Sport } from '@/types/db'

export function useSports() {
  return useQuery({
    queryKey: ['sports'],
    queryFn: async (): Promise<Sport[]> => {
      const { data, error } = await supabase
        .from('sports')
        .select('*')
        .order('display_order', { ascending: true })
      if (error) throw error
      return data as Sport[]
    },
    staleTime: Infinity,
  })
}
