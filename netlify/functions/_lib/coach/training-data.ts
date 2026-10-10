// Caricamento del log di forza per l'analisi lato server.
// Usato dal contesto chat, dal coach allenamento e dalla review di fase.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SetRecord } from './training-rules'

export type SessionSummary = {
  id: string
  name: string
  started_at: string
  duration_sec: number | null
  total_volume_kg: number
  total_sets: number
  session_rpe: number | null
  routine_id: string | null
}

/**
 * Serie allenanti delle ultime `weeks` settimane, già appiattite con i
 * metadati dell'esercizio. Una sola query annidata invece della catena
 * sessioni → esercizi → serie.
 */
export async function loadTrainingSets(
  supabase: SupabaseClient,
  userId: string,
  weeks: number,
): Promise<{ sets: SetRecord[]; sessions: SessionSummary[] }> {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      `id, name, started_at, duration_sec, total_volume_kg, total_sets, session_rpe, routine_id,
       session_exercises (
         exercise_id,
         exercise:exercise_catalog ( name, primary_muscle, secondary_muscles, movement_pattern, discouraged, discouraged_reason ),
         session_sets ( set_type, weight_kg, reps, rpe, completed )
       )`,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false })

  if (error) {
    console.error('loadTrainingSets:', error.message)
    return { sets: [], sessions: [] }
  }

  const sets: SetRecord[] = []
  const sessions: SessionSummary[] = []

  for (const s of (data ?? []) as unknown as Array<
    SessionSummary & {
      session_exercises: Array<{
        exercise_id: string
        exercise: {
          name: string
          primary_muscle: string
          secondary_muscles: string[]
          movement_pattern: string | null
          discouraged: boolean
          discouraged_reason: string | null
        } | null
        session_sets: Array<{
          set_type: string
          weight_kg: number | null
          reps: number | null
          rpe: number | null
          completed: boolean
        }>
      }>
    }
  >) {
    sessions.push({
      id: s.id,
      name: s.name,
      started_at: s.started_at,
      duration_sec: s.duration_sec,
      total_volume_kg: Number(s.total_volume_kg ?? 0),
      total_sets: s.total_sets,
      session_rpe: s.session_rpe,
      routine_id: s.routine_id,
    })

    for (const se of s.session_exercises ?? []) {
      const ex = se.exercise
      if (!ex) continue
      for (const ss of se.session_sets ?? []) {
        if (!ss.completed) continue
        sets.push({
          exerciseId: se.exercise_id,
          exerciseName: ex.name,
          primaryMuscle: ex.primary_muscle,
          secondaryMuscles: ex.secondary_muscles ?? [],
          movementPattern: ex.movement_pattern,
          discouraged: ex.discouraged,
          discouragedReason: ex.discouraged_reason,
          weightKg: ss.weight_kg,
          reps: ss.reps,
          rpe: ss.rpe,
          setType: ss.set_type,
          performedAt: s.started_at,
        })
      }
    }
  }

  return { sets, sessions }
}

// --------------------------------------------------------------
// Schede pianificate (routines) — ciò che l'utente ha in programma
// --------------------------------------------------------------

export type RoutineExercisePlan = {
  name: string
  primary_muscle: string
  target_sets: number
  rep_min: number | null
  rep_max: number | null
  target_rpe: number | null
  rest_sec: number | null
}

export type RoutinePlanSummary = {
  id: string
  name: string
  description: string | null
  weekday: number | null
  folder_name: string | null
  folder_goal: string | null
  last_performed_at: string | null
  exercises: RoutineExercisePlan[]
}

const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

/**
 * Schede non archiviate dell'utente, con esercizi e (se c'è) il
 * programma/folder. Usato dalla chat generale: senza questo blocco
 * il modello inventa la "scheda attuale".
 */
export async function loadActiveRoutines(
  supabase: SupabaseClient,
  userId: string,
): Promise<RoutinePlanSummary[]> {
  const { data, error } = await supabase
    .from('routines')
    .select(
      `id, name, description, weekday, last_performed_at, position,
       folder:routine_folders ( name, goal, archived ),
       routine_exercises (
         position, target_sets, rep_min, rep_max, target_rpe, rest_sec,
         exercise:exercise_catalog ( name, primary_muscle )
       )`,
    )
    .eq('user_id', userId)
    .eq('archived', false)
    .order('position', { ascending: true })

  if (error) {
    console.error('loadActiveRoutines:', error.message)
    return []
  }

  type Row = {
    id: string
    name: string
    description: string | null
    weekday: number | null
    last_performed_at: string | null
    folder: { name: string; goal: string | null; archived: boolean } | null
    routine_exercises: Array<{
      position: number
      target_sets: number
      rep_min: number | null
      rep_max: number | null
      target_rpe: number | null
      rest_sec: number | null
      exercise: { name: string; primary_muscle: string } | null
    }>
  }

  return ((data ?? []) as unknown as Row[])
    .filter((r) => !r.folder?.archived)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      weekday: r.weekday,
      folder_name: r.folder?.name ?? null,
      folder_goal: r.folder?.goal ?? null,
      last_performed_at: r.last_performed_at,
      exercises: (r.routine_exercises ?? [])
        .filter((re) => re.exercise)
        .sort((a, b) => a.position - b.position)
        .map((re) => ({
          name: re.exercise!.name,
          primary_muscle: re.exercise!.primary_muscle,
          target_sets: re.target_sets,
          rep_min: re.rep_min,
          rep_max: re.rep_max,
          target_rpe: re.target_rpe,
          rest_sec: re.rest_sec,
        })),
    }))
}

/** Sezione markdown "Schede attive" per il system prompt della chat. */
export function formatActiveRoutines(routines: RoutinePlanSummary[]): string {
  const lines: string[] = ['## Schede attive (programma pianificato)']
  if (routines.length === 0) {
    lines.push(
      'Nessuna scheda salvata per questo utente. Se chiede della "scheda" o del programma, dillo chiaramente: non inventare esercizi, serie o split.',
    )
    return lines.join('\n')
  }

  lines.push(
    "Queste sono le uniche schede dell'utente. Per valutarle o modificarle usa SOLO questi dati; non aggiungere esercizi assenti dall'elenco.",
  )

  // Raggruppa per programma per leggibilità
  const byFolder = new Map<string, RoutinePlanSummary[]>()
  for (const r of routines) {
    const key = r.folder_name ?? '(senza programma)'
    if (!byFolder.has(key)) byFolder.set(key, [])
    byFolder.get(key)!.push(r)
  }

  for (const [folder, list] of byFolder) {
    const goal = list.find((r) => r.folder_goal)?.folder_goal
    lines.push(
      `### Programma: ${folder}${goal ? ` · obiettivo ${goal}` : ''}`,
    )
    for (const r of list) {
      const day =
        r.weekday != null && r.weekday >= 0 && r.weekday <= 6
          ? WEEKDAYS[r.weekday]
          : null
      const last = r.last_performed_at
        ? ` · ultima volta ${r.last_performed_at.slice(0, 10)}`
        : ''
      lines.push(
        `#### Scheda: ${r.name}${day ? ` (${day})` : ''}${last}`,
      )
      if (r.description) lines.push(r.description)
      if (r.exercises.length === 0) {
        lines.push('- (nessun esercizio in scheda)')
        continue
      }
      for (const e of r.exercises) {
        const reps =
          e.rep_min != null || e.rep_max != null
            ? `${e.rep_min ?? '?'}-${e.rep_max ?? '?'} rep`
            : 'rep libere'
        const rpe = e.target_rpe != null ? ` @RPE ${e.target_rpe}` : ''
        lines.push(
          `- ${e.name} (${e.primary_muscle}): ${e.target_sets} serie · ${reps}${rpe}`,
        )
      }
    }
  }
  return lines.join('\n')
}

/** Righe compatte "cosa ha fatto nelle ultime sedute" per il prompt. */
export function formatRecentSessions(
  sessions: SessionSummary[],
  sets: SetRecord[],
  limit = 6,
): string[] {
  const bySession = new Map<string, Map<string, { sets: number; top: number }>>()
  for (const s of sets) {
    // Raggruppo per giorno: le SetRecord non portano l'id sessione.
    const key = s.performedAt
    if (!bySession.has(key)) bySession.set(key, new Map())
    const m = bySession.get(key)!
    const cur = m.get(s.exerciseName) ?? { sets: 0, top: 0 }
    cur.sets += 1
    if (s.weightKg) cur.top = Math.max(cur.top, Number(s.weightKg))
    m.set(s.exerciseName, cur)
  }

  const lines: string[] = []
  for (const s of sessions.slice(0, limit)) {
    const day = s.started_at.slice(0, 10)
    const exercises = bySession.get(s.started_at)
    const detail = exercises
      ? [...exercises.entries()]
          .map(([name, v]) => `${name} ${v.sets}×${v.top ? `${v.top}kg` : '—'}`)
          .join(', ')
      : '—'
    const min = s.duration_sec ? Math.round(s.duration_sec / 60) : null
    lines.push(
      `- ${day} · ${s.name}${min ? ` · ${min}min` : ''} · ${Math.round(s.total_volume_kg)} kg di volume${s.session_rpe ? ` · RPE ${s.session_rpe}` : ''}: ${detail}`,
    )
  }
  return lines
}
