// Recupero: in database è sempre in secondi (`rest_sec` / `default_rest_sec`).
// Il timer e le etichette devono usare quegli stessi secondi, non un altro
// valore del catalogo e non un'unità diversa.

export const DEFAULT_REST_SEC = 120

export function formatRestClock(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Etichetta compatta per la scheda: 120 secondi salvati → "2 min". */
export function formatRestMinutes(storedSeconds: number): string {
  const total = Math.max(0, Math.round(storedSeconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m <= 0) return `${s}s`
  if (s === 0) return `${m} min`
  return `${m} min ${s}s`
}

export function formatRemainingMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return formatRestClock(total)
}

/** Millisecondi che il timer deve contare per i secondi salvati. */
export function initialRestMs(storedSeconds: number): number {
  const sec = Math.max(1, Math.round(storedSeconds))
  return sec * 1000
}

function positive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * I secondi della scheda vincono sul default del catalogo.
 * Se la scheda dice 120 (2 min) e il catalogo 180 (3 min), il timer conta 120.
 */
export function resolveRestSeconds(
  routineRestSec: number | null | undefined,
  catalogRestSec: number | null | undefined,
  fallback = DEFAULT_REST_SEC,
): number {
  const chosen = positive(routineRestSec) ?? positive(catalogRestSec) ?? fallback
  return Math.round(chosen)
}

export function routineRestForExercise(
  exercise: { position: number; exercise_id: string },
  routineExercises:
    | Array<{ position: number; exercise_id: string; rest_sec: number | null }>
    | undefined,
): number | null {
  if (!routineExercises?.length) return null
  const sameSlot = routineExercises.find(
    (r) =>
      r.position === exercise.position && r.exercise_id === exercise.exercise_id,
  )
  if (sameSlot) return sameSlot.rest_sec
  const sameExercise = routineExercises.filter(
    (r) => r.exercise_id === exercise.exercise_id,
  )
  if (sameExercise.length === 1) return sameExercise[0].rest_sec
  return null
}
