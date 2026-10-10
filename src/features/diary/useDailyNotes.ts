import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export type DailyNote = {
  id: string
  user_id: string
  note_date: string // YYYY-MM-DD
  body: string
  energy: number | null
  created_at: string
  updated_at: string
}

export type DailyNoteInput = {
  note_date: string
  body: string
  energy?: number | null
}

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function useDailyNoteForDate(date: Date) {
  const { user } = useAuth()
  const noteDate = toLocalDateStr(date)
  return useQuery({
    queryKey: ['daily-note', user?.id, noteDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('user_id', user!.id)
        .eq('note_date', noteDate)
        .maybeSingle()
      if (error) throw error
      return (data as DailyNote | null) ?? null
    },
    enabled: !!user,
  })
}

export function useUpsertDailyNote() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DailyNoteInput) => {
      const body = input.body.trim()
      const energy = input.energy ?? null

      // Empty note + no energy → delete if exists (keeps table clean)
      if (!body && energy == null) {
        const { error } = await supabase
          .from('daily_notes')
          .delete()
          .eq('user_id', user!.id)
          .eq('note_date', input.note_date)
        if (error) throw error
        return null
      }

      const { data, error } = await supabase
        .from('daily_notes')
        .upsert(
          {
            user_id: user!.id,
            note_date: input.note_date,
            body,
            energy,
          },
          { onConflict: 'user_id,note_date' },
        )
        .select()
        .single()
      if (error) throw error
      return data as DailyNote
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['daily-note', user?.id, vars.note_date] })
      qc.invalidateQueries({ queryKey: ['daily-notes'] })
    },
  })
}
