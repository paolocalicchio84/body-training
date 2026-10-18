import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { clearWorkoutActivity } from './sessionClock'
import { estimate1rm } from './types'
import type {
  LastPerformance,
  SessionSet,
  SessionWithExercises,
  SetType,
  WorkoutSession,
} from './types'

const EXERCISE_COLS =
  'id, user_id, name, aliases, primary_muscle, secondary_muscles, equipment, movement_pattern, plane, joint_type, is_unilateral, tracking_type, biomech_notes, cues, common_errors, contraindications, tier, discouraged, discouraged_reason, default_rest_sec, video_url, archived'

const SESSION_DEEP_SELECT = `
  *,
  session_exercises (
    *,
    exercise:exercise_catalog ( ${EXERCISE_COLS} ),
    session_sets ( * )
  )
`

function sortSession(s: SessionWithExercises): SessionWithExercises {
  s.session_exercises.sort((a, b) => a.position - b.position)
  for (const se of s.session_exercises) {
    se.session_sets.sort((a, b) => a.position - b.position)
  }
  return s
}

// --------------------------------------------------------------
// Lettura
// --------------------------------------------------------------

export function useActiveSession() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['active-session', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(SESSION_DEEP_SELECT)
        .eq('status', 'in_progress')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return sortSession(data as unknown as SessionWithExercises)
    },
    enabled: !!user,
  })
}

export function useSession(sessionId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(SESSION_DEEP_SELECT)
        .eq('id', sessionId!)
        .single()
      if (error) throw error
      return sortSession(data as unknown as SessionWithExercises)
    },
    enabled: !!user && !!sessionId,
  })
}

export function useSessions(limit = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['sessions', user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as WorkoutSession[]
    },
    enabled: !!user,
  })
}

// Ultima prestazione per ciascun esercizio: alimenta i placeholder
// "come l'ultima volta" nel logger. Una sola RPC per tutta la scheda.
export function useLastPerformance(exerciseIds: string[]) {
  const { user } = useAuth()
  const key = [...exerciseIds].sort().join(',')
  return useQuery({
    queryKey: ['last-performance', user?.id, key],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('last_performance', {
        p_exercise_ids: exerciseIds,
      })
      if (error) throw error
      const map = new Map<string, LastPerformance>()
      for (const row of (data ?? []) as LastPerformance[]) {
        map.set(row.exercise_id, row)
      }
      return map
    },
    enabled: !!user && exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

// --------------------------------------------------------------
// Ciclo di vita della sessione
// --------------------------------------------------------------

export function useStartSession() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { routineId?: string | null; name?: string }) => {
      const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user!.id,
          routine_id: input.routineId ?? null,
          name: input.name?.trim() || 'Allenamento libero',
        })
        .select('*')
        .single()
      if (error) {
        // Vincolo workout_sessions_one_active: succede con due schede
        // aperte o con la cache stale.
        if (error.code === '23505') {
          throw new Error(
            'Hai già un allenamento in corso. Riprendilo o scartalo prima di iniziarne un altro.',
          )
        }
        throw error
      }

      // Da scheda: precarico esercizi e serie pianificate (non completate).
      if (input.routineId) {
        await seedFromRoutine(session.id, input.routineId)
      }
      return session as WorkoutSession
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session'] })
    },
  })
}

async function seedFromRoutine(sessionId: string, routineId: string) {
  const { data: routineExercises, error } = await supabase
    .from('routine_exercises')
    .select('*, routine_sets(*)')
    .eq('routine_id', routineId)
    .order('position')
  if (error) throw error
  if (!routineExercises?.length) return

  const { data: inserted, error: seErr } = await supabase
    .from('session_exercises')
    .insert(
      routineExercises.map((re) => ({
        session_id: sessionId,
        exercise_id: re.exercise_id,
        position: re.position,
        superset_group: re.superset_group,
        notes: re.notes,
      })),
    )
    .select('id, position')
  if (seErr) throw seErr

  const byPosition = new Map((inserted ?? []).map((r) => [r.position, r.id]))
  const setRows = routineExercises.flatMap((re) => {
    const seId = byPosition.get(re.position)
    if (!seId) return []
    const planned = (re.routine_sets ?? []) as Array<{
      position: number
      set_type: SetType
      target_reps: number | null
      target_weight_kg: number | null
      target_rpe: number | null
    }>
    // Se la scheda definisce i target serie per serie li uso, altrimenti
    // creo target_sets righe vuote con il range di ripetizioni.
    if (planned.length > 0) {
      return planned
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          session_exercise_id: seId,
          position: s.position,
          set_type: s.set_type,
          weight_kg: s.target_weight_kg,
          reps: s.target_reps,
          completed: false,
        }))
    }
    return Array.from({ length: re.target_sets }, (_, i) => ({
      session_exercise_id: seId,
      position: i,
      set_type: 'normal' as SetType,
      weight_kg: null,
      reps: re.rep_max ?? re.rep_min ?? null,
      completed: false,
    }))
  })
  if (setRows.length > 0) {
    const { error: setErr } = await supabase.from('session_sets').insert(setRows)
    if (setErr) throw setErr
  }
}

export function useFinishSession() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      sessionId: string
      notes?: string | null
      sessionRpe?: number | null
      kcalBurned?: number | null
      /** Se presente, è la durata confermata: non il wall clock da started_at. */
      durationSec?: number | null
    }) => {
      const { data: session, error: readErr } = await supabase
        .from('workout_sessions')
        .select(SESSION_DEEP_SELECT)
        .eq('id', input.sessionId)
        .single()
      if (readErr) throw readErr
      const full = sortSession(session as unknown as SessionWithExercises)

      // Le serie mai completate non devono restare nel log.
      const ghostIds = full.session_exercises.flatMap((se) =>
        se.session_sets.filter((s) => !s.completed).map((s) => s.id),
      )
      if (ghostIds.length > 0) {
        const { error: delErr } = await supabase
          .from('session_sets')
          .delete()
          .in('id', ghostIds)
        if (delErr) throw delErr
      }

      const startedAt = new Date(full.started_at)
      const durationSec =
        input.durationSec != null
          ? Math.max(60, Math.round(input.durationSec))
          : Math.max(
              60,
              Math.round((Date.now() - startedAt.getTime()) / 1000),
            )
      // Con una durata esplicita la fine coincide con inizio + durata, così
      // un buco di ore non resta scritto come tempo di allenamento.
      const endedAt =
        input.durationSec != null
          ? new Date(startedAt.getTime() + durationSec * 1000)
          : new Date()

      const { error: updErr } = await supabase
        .from('workout_sessions')
        .update({
          status: 'completed',
          ended_at: endedAt.toISOString(),
          duration_sec: durationSec,
          notes: input.notes ?? full.notes,
          session_rpe: input.sessionRpe ?? full.session_rpe,
        })
        .eq('id', input.sessionId)
      if (updErr) throw updErr

      if (full.routine_id) {
        const { error: rErr } = await supabase
          .from('routines')
          .update({ last_performed_at: endedAt.toISOString() })
          .eq('id', full.routine_id)
        if (rErr) throw rErr
      }

      // Riga in `workouts`: mantiene Home, Trends e il contesto AI
      // allineati senza doppia scrittura manuale da parte dell'utente.
      const { error: wErr } = await supabase.from('workouts').upsert(
        {
          user_id: user!.id,
          session_id: input.sessionId,
          started_at: full.started_at,
          duration_min: Math.max(1, Math.round(durationSec / 60)),
          workout_type: full.name,
          intensity: rpeToIntensity(input.sessionRpe ?? full.session_rpe),
          kcal_burned: input.kcalBurned ?? null,
          notes: input.notes ?? full.notes,
        },
        { onConflict: 'session_id' },
      )
      if (wErr) throw wErr

      // Per ultimo: la sessione è già salvata, se il rilevamento record
      // fallisce si perdono solo i toast, non l'allenamento.
      const prs = await detectAndSavePrs(user!.id, full)

      return { prs }
    },
    onSuccess: (_data, vars) => {
      clearWorkoutActivity(vars.sessionId)
      qc.invalidateQueries({ queryKey: ['active-session'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['personal-records'] })
      qc.invalidateQueries({ queryKey: ['last-performance'] })
      qc.invalidateQueries({ queryKey: ['muscle-volume'] })
      qc.invalidateQueries({ queryKey: ['weekly-volume'] })
      qc.invalidateQueries({ queryKey: ['training-summary'] })
      qc.invalidateQueries({ queryKey: ['exercise-history'] })
      qc.invalidateQueries({ queryKey: ['routines'] })
    },
  })
}

function rpeToIntensity(rpe: number | null): 'low' | 'moderate' | 'high' {
  if (rpe == null) return 'moderate'
  if (rpe <= 5) return 'low'
  if (rpe >= 8) return 'high'
  return 'moderate'
}

export type DetectedPr = {
  exercise_id: string
  exercise_name: string
  record_type: 'est_1rm' | 'max_weight' | 'max_set_volume' | 'max_reps'
  value: number
  weight_kg: number | null
  reps: number | null
}

// Esercizi in cui il carico non è la variabile allenante: il record
// sensato è il numero di ripetizioni, non i kg.
const BODYWEIGHT_TRACKING = new Set(['reps_only', 'duration'])

// Confronta i best set della sessione con i record storici. Una sola query
// per leggere i record precedenti di tutti gli esercizi della seduta.
async function detectAndSavePrs(
  userId: string,
  session: SessionWithExercises,
): Promise<DetectedPr[]> {
  const exerciseIds = [
    ...new Set(session.session_exercises.map((se) => se.exercise_id)),
  ]
  if (exerciseIds.length === 0) return []

  const { data: existing, error: readErr } = await supabase
    .from('personal_records')
    .select('exercise_id, record_type, value')
    .in('exercise_id', exerciseIds)

  // Senza lo storico ogni serie sembrerebbe un record: meglio non
  // dichiarare nulla che riempire la tabella di PR falsi.
  if (readErr) {
    console.error('Lettura record personali fallita:', readErr.message)
    return []
  }

  const best = new Map<string, number>()
  for (const r of existing ?? []) {
    const k = `${r.exercise_id}:${r.record_type}`
    best.set(k, Math.max(best.get(k) ?? 0, Number(r.value)))
  }

  const found: DetectedPr[] = []
  const rows: Array<Record<string, unknown>> = []

  for (const se of session.session_exercises) {
    // weight_kg può essere 0 o null sul corpo libero: conta che ci sia
    // almeno un numero di ripetizioni.
    const workSets = se.session_sets.filter(
      (s) => s.completed && s.set_type !== 'warmup' && s.reps,
    )
    if (workSets.length === 0) continue
    const name = se.exercise?.name ?? 'Esercizio'
    const isBodyweight = BODYWEIGHT_TRACKING.has(
      se.exercise?.tracking_type ?? 'weight_reps',
    )

    const candidates: Array<{
      type: DetectedPr['record_type']
      value: number
      set: SessionSet
    }> = []

    let top1rm = { value: 0, set: workSets[0] }
    let topWeight = { value: 0, set: workSets[0] }
    let topVolume = { value: 0, set: workSets[0] }
    let topReps = { value: 0, set: workSets[0] }
    for (const s of workSets) {
      const w = Number(s.weight_kg ?? 0)
      const r = Number(s.reps)
      const e = estimate1rm(w, r)
      if (e > top1rm.value) top1rm = { value: e, set: s }
      if (w > topWeight.value) topWeight = { value: w, set: s }
      if (w * r > topVolume.value) topVolume = { value: w * r, set: s }
      if (r > topReps.value) topReps = { value: r, set: s }
    }
    if (isBodyweight) {
      candidates.push({ type: 'max_reps', ...topReps })
    } else {
      candidates.push({ type: 'est_1rm', ...top1rm })
      candidates.push({ type: 'max_weight', ...topWeight })
      candidates.push({ type: 'max_set_volume', ...topVolume })
    }

    for (const c of candidates) {
      if (c.value <= 0) continue
      const key = `${se.exercise_id}:${c.type}`
      const prev = best.get(key) ?? 0
      if (c.value <= prev) continue
      // Lo stesso esercizio può comparire due volte nella seduta: senza
      // questo, il secondo blocco genererebbe un PR duplicato.
      best.set(key, c.value)
      found.push({
        exercise_id: se.exercise_id,
        exercise_name: name,
        record_type: c.type,
        value: Math.round(c.value * 10) / 10,
        weight_kg: c.set.weight_kg,
        reps: c.set.reps,
      })
      rows.push({
        user_id: userId,
        exercise_id: se.exercise_id,
        record_type: c.type,
        value: Math.round(c.value * 10) / 10,
        weight_kg: c.set.weight_kg,
        reps: c.set.reps,
        session_set_id: c.set.id,
        session_id: session.id,
      })
    }
  }

  if (rows.length > 0) {
    await supabase.from('personal_records').insert(rows)
    const prSetIds = [...new Set(rows.map((r) => r.session_set_id as string))]
    await supabase
      .from('session_sets')
      .update({ is_pr: true })
      .in('id', prSetIds)
  }
  return found
}

export function useDiscardSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: (_data, sessionId) => {
      clearWorkoutActivity(sessionId)
      qc.invalidateQueries({ queryKey: ['active-session'] })
    },
  })
}

export function useUpdateCompletedSession() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      sessionId: string
      startedAt: string
      durationSec: number
      notes: string | null
    }) => {
      const durationSec = Math.max(60, Math.round(input.durationSec))
      const startedAt = new Date(input.startedAt)
      if (Number.isNaN(startedAt.getTime())) {
        throw new Error('Data di inizio non valida')
      }
      const endedAt = new Date(startedAt.getTime() + durationSec * 1000)
      const notes = input.notes?.trim() ? input.notes.trim() : null

      const { error: updErr } = await supabase
        .from('workout_sessions')
        .update({
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          duration_sec: durationSec,
          notes,
        })
        .eq('id', input.sessionId)
        .eq('status', 'completed')
      if (updErr) throw updErr

      const { data: session, error: readErr } = await supabase
        .from('workout_sessions')
        .select('name, session_rpe, user_id')
        .eq('id', input.sessionId)
        .single()
      if (readErr || !session) throw readErr ?? new Error('Seduta non trovata')

      const row = session as {
        name: string
        session_rpe: number | null
        user_id: string
      }
      const durationMin = Math.max(1, Math.round(durationSec / 60))
      const { data: existing, error: wReadErr } = await supabase
        .from('workouts')
        .select('id')
        .eq('session_id', input.sessionId)
        .maybeSingle()
      if (wReadErr) throw wReadErr

      if (existing) {
        const { error } = await supabase
          .from('workouts')
          .update({
            started_at: startedAt.toISOString(),
            duration_min: durationMin,
            notes,
          })
          .eq('id', (existing as { id: string }).id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('workouts').insert({
          user_id: row.user_id ?? user!.id,
          session_id: input.sessionId,
          started_at: startedAt.toISOString(),
          duration_min: durationMin,
          workout_type: row.name,
          intensity: rpeToIntensity(row.session_rpe),
          notes,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['training-summary'] })
      qc.invalidateQueries({ queryKey: ['weekly-volume'] })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['muscle-volume'] })
      qc.invalidateQueries({ queryKey: ['weekly-volume'] })
      qc.invalidateQueries({ queryKey: ['training-summary'] })
      qc.invalidateQueries({ queryKey: ['exercise-history'] })
      qc.invalidateQueries({ queryKey: ['personal-records'] })
      qc.invalidateQueries({ queryKey: ['last-performance'] })
    },
  })
}

// --------------------------------------------------------------
// Editing della sessione attiva
// --------------------------------------------------------------

export function useAddSessionExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      sessionId: string
      exerciseId: string
      position: number
      defaultSets?: number
    }) => {
      const { data: se, error } = await supabase
        .from('session_exercises')
        .insert({
          session_id: input.sessionId,
          exercise_id: input.exerciseId,
          position: input.position,
        })
        .select('id')
        .single()
      if (error) throw error

      const n = input.defaultSets ?? 3
      const { error: setErr } = await supabase.from('session_sets').insert(
        Array.from({ length: n }, (_, i) => ({
          session_exercise_id: se.id,
          position: i,
          set_type: 'normal' as SetType,
          completed: false,
        })),
      )
      if (setErr) throw setErr
      return se.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}

export function useRemoveSessionExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionExerciseId: string) => {
      const { error } = await supabase
        .from('session_exercises')
        .delete()
        .eq('id', sessionExerciseId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}

export function useAddSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      sessionExerciseId: string
      position: number
      setType?: SetType
      weightKg?: number | null
      reps?: number | null
    }) => {
      const { data, error } = await supabase
        .from('session_sets')
        .insert({
          session_exercise_id: input.sessionExerciseId,
          position: input.position,
          set_type: input.setType ?? 'normal',
          weight_kg: input.weightKg ?? null,
          reps: input.reps ?? null,
          completed: false,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as SessionSet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}

export type SetPatch = Partial<
  Pick<
    SessionSet,
    | 'weight_kg'
    | 'reps'
    | 'rpe'
    | 'rir'
    | 'duration_sec'
    | 'distance_m'
    | 'completed'
    | 'set_type'
    | 'notes'
  >
>

// Aggiornamento ottimistico: in palestra la rete è inaffidabile e il
// campo deve rispondere subito. La cache viene riallineata al ritorno.
export function useUpdateSet() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SetPatch }) => {
      const { error } = await supabase
        .from('session_sets')
        .update(patch)
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) => {
      const key = ['active-session', user?.id]
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<SessionWithExercises | null>(key)
      if (previous) {
        qc.setQueryData<SessionWithExercises | null>(key, {
          ...previous,
          session_exercises: previous.session_exercises.map((se) => ({
            ...se,
            session_sets: se.session_sets.map((s) =>
              s.id === id ? { ...s, ...patch } : s,
            ),
          })),
        })
      }
      return { previous, key }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}

export function useDeleteSet() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('session_sets').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      const key = ['active-session', user?.id]
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<SessionWithExercises | null>(key)
      if (previous) {
        qc.setQueryData<SessionWithExercises | null>(key, {
          ...previous,
          session_exercises: previous.session_exercises.map((se) => ({
            ...se,
            session_sets: se.session_sets.filter((s) => s.id !== id),
          })),
        })
      }
      return { previous, key }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(ctx.key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}

export function useUpdateExerciseNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string
      notes: string | null
    }) => {
      const { error } = await supabase
        .from('session_exercises')
        .update({ notes })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}

export function useUpdateSessionMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<WorkoutSession, 'name' | 'notes' | 'session_rpe'>>
    }) => {
      const { error } = await supabase
        .from('workout_sessions')
        .update(patch)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-session'] }),
  })
}
