import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Exercise } from './types'

const EXERCISE_COLS =
  'id, user_id, name, aliases, primary_muscle, secondary_muscles, equipment, movement_pattern, plane, joint_type, is_unilateral, tracking_type, biomech_notes, cues, common_errors, contraindications, tier, discouraged, discouraged_reason, default_rest_sec, video_url, archived'

// La libreria esercizi è quasi statica (seed globale + pochi custom):
// la teniamo in cache a lungo e filtriamo lato client, evitando una query
// per ogni battuta nel campo di ricerca.
export function useExercises() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['exercise-catalog', user?.id],
    queryFn: async () => {
      const [catalogRes, overridesRes] = await Promise.all([
        supabase
          .from('exercise_catalog')
          .select(EXERCISE_COLS)
          .eq('archived', false)
          .order('name'),
        supabase
          .from('exercise_video_overrides')
          .select('exercise_id, video_url')
          .eq('user_id', user!.id),
      ])
      if (catalogRes.error) throw catalogRes.error
      // Tabella 0015 assente finché non applicata: ignora e usa solo catalogo.
      const overrides = new Map<string, string | null>()
      if (!overridesRes.error) {
        for (const row of overridesRes.data ?? []) {
          overrides.set(row.exercise_id as string, row.video_url as string | null)
        }
      }
      const rows = (catalogRes.data ?? []) as Exercise[]
      if (overrides.size === 0) return rows
      return rows.map((e) =>
        overrides.has(e.id)
          ? { ...e, video_url: overrides.get(e.id) ?? null }
          : e,
      )
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

export function useExercise(exerciseId: string | null) {
  const { data: all } = useExercises()
  return useMemo(
    () => all?.find((e) => e.id === exerciseId) ?? null,
    [all, exerciseId],
  )
}

// Ricerca fuzzy su nome + alias + gruppo muscolare, con i fondamentali
// (tier 1) in cima a parità di match.
export function useExerciseSearch(
  query: string,
  filters?: { muscle?: string | null; equipment?: string | null },
) {
  const { data: all = [], isLoading } = useExercises()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = all

    if (filters?.muscle) {
      list = list.filter(
        (e) =>
          e.primary_muscle === filters.muscle ||
          e.secondary_muscles.includes(filters.muscle!),
      )
    }
    if (filters?.equipment) {
      list = list.filter((e) => e.equipment === filters.equipment)
    }
    if (!q) {
      return [...list].sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
      )
    }

    const scored: Array<{ e: Exercise; score: number }> = []
    for (const e of list) {
      const name = e.name.toLowerCase()
      let score = -1
      if (name.startsWith(q)) score = 0
      else if (name.includes(q)) score = 1
      else if (e.aliases.some((a) => a.toLowerCase().includes(q))) score = 2
      else if (e.primary_muscle.includes(q)) score = 3
      if (score >= 0) scored.push({ e, score })
    }
    return scored
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.e.tier - b.e.tier ||
          a.e.name.localeCompare(b.e.name),
      )
      .map((s) => s.e)
  }, [all, query, filters?.muscle, filters?.equipment])

  return { results, isLoading }
}

export type ExerciseInput = {
  name: string
  primary_muscle: string
  secondary_muscles?: string[]
  equipment?: string
  movement_pattern?: string | null
  joint_type?: string
  is_unilateral?: boolean
  tracking_type?: Exercise['tracking_type']
  default_rest_sec?: number | null
  notes?: string | null
}

export function useCreateExercise() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ExerciseInput) => {
      const { data, error } = await supabase
        .from('exercise_catalog')
        .insert({
          user_id: user!.id,
          name: input.name,
          primary_muscle: input.primary_muscle,
          secondary_muscles: input.secondary_muscles ?? [],
          equipment: input.equipment ?? 'altro',
          movement_pattern: input.movement_pattern ?? null,
          joint_type: input.joint_type ?? 'multi',
          is_unilateral: input.is_unilateral ?? false,
          tracking_type: input.tracking_type ?? 'weight_reps',
          default_rest_sec: input.default_rest_sec ?? null,
          biomech_notes: input.notes ?? null,
          tier: 3,
        })
        .select(EXERCISE_COLS)
        .single()
      if (error) throw error
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercise-catalog'] }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: l'esercizio può essere referenziato da sessioni passate.
      const { error } = await supabase
        .from('exercise_catalog')
        .update({ archived: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercise-catalog'] }),
  })
}

/**
 * Salva URL demo. Esercizi custom (tuoi): aggiorna catalogo.
 * Seed globali: upsert in exercise_video_overrides (RLS).
 */
export function useUpdateExerciseVideoUrl() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      video_url: string | null
      /** Se true, esercizio seed globale → override utente */
      isGlobal?: boolean
    }) => {
      const video_url = input.video_url?.trim() || null
      const isGlobal = input.isGlobal ?? false

      if (!isGlobal) {
        const { data, error } = await supabase
          .from('exercise_catalog')
          .update({ video_url })
          .eq('id', input.id)
          .eq('user_id', user!.id)
          .select(EXERCISE_COLS)
          .single()
        if (error) throw error
        return data as Exercise
      }

      if (video_url == null) {
        const { error } = await supabase
          .from('exercise_video_overrides')
          .delete()
          .eq('user_id', user!.id)
          .eq('exercise_id', input.id)
        if (error) throw error
        return null
      }

      const { error } = await supabase.from('exercise_video_overrides').upsert(
        {
          user_id: user!.id,
          exercise_id: input.id,
          video_url,
        },
        { onConflict: 'user_id,exercise_id' },
      )
      if (error) throw error
      return null
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercise-catalog'] }),
  })
}
