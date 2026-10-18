// Il cronometro della seduta conta solo il tempo in cui l'app è aperta.
// Un buco (app chiusa, in background o lasciata ferma) non entra nella durata.

export const STALE_GAP_MS = 3 * 60 * 1000
export const SENSIBLE_DURATION_SEC = 60 * 60
/** Senza battito locale, oltre questo wall clock non è una durata credibile. */
export const UNTRACKED_WALL_LIMIT_SEC = 90 * 60

const STORAGE_KEY = 'mhl-workout-activity'

export type ActivitySnapshot = {
  sessionId: string
  accumulatedSec: number
  lastTickAt: number
}

export type ClockDecision = {
  /** Secondi da mostrare. Non include il buco che ha aperto il prompt. */
  accumulatedSec: number
  prompt: boolean
  /** Durata proposta per chiudere la seduta, in secondi. */
  suggestedDurationSec: number
}

export function suggestedDurationSec(input: {
  wallSec: number
  accumulatedSec: number | null
}): number {
  if (input.accumulatedSec != null) {
    return Math.max(60, Math.round(input.accumulatedSec))
  }
  const wall = Math.max(0, Math.round(input.wallSec))
  if (wall <= UNTRACKED_WALL_LIMIT_SEC) return Math.max(60, wall)
  return SENSIBLE_DURATION_SEC
}

export function decideClock(input: {
  sessionId: string
  startedAtMs: number
  nowMs: number
  stored: ActivitySnapshot | null
}): ClockDecision {
  const wallSec = Math.max(
    0,
    Math.floor((input.nowMs - input.startedAtMs) / 1000),
  )
  const stored =
    input.stored && input.stored.sessionId === input.sessionId
      ? input.stored
      : null

  if (!stored) {
    const prompt = wallSec * 1000 > STALE_GAP_MS
    if (prompt) {
      return {
        accumulatedSec: 0,
        prompt: true,
        suggestedDurationSec: suggestedDurationSec({
          wallSec,
          accumulatedSec: null,
        }),
      }
    }
    return {
      accumulatedSec: wallSec,
      prompt: false,
      suggestedDurationSec: Math.max(60, wallSec),
    }
  }

  const gapMs = input.nowMs - stored.lastTickAt
  if (gapMs > STALE_GAP_MS) {
    const acc = Math.max(0, Math.round(stored.accumulatedSec))
    return {
      accumulatedSec: acc,
      prompt: true,
      suggestedDurationSec: suggestedDurationSec({
        wallSec,
        accumulatedSec: acc,
      }),
    }
  }

  const acc = stored.accumulatedSec + Math.max(0, Math.floor(gapMs / 1000))
  return {
    accumulatedSec: acc,
    prompt: false,
    suggestedDurationSec: Math.max(60, Math.round(acc)),
  }
}

export function readWorkoutActivity(sessionId: string): ActivitySnapshot | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActivitySnapshot
    if (parsed.sessionId !== sessionId) return null
    if (
      !Number.isFinite(parsed.accumulatedSec) ||
      !Number.isFinite(parsed.lastTickAt)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeWorkoutActivity(snapshot: ActivitySnapshot) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function clearWorkoutActivity(sessionId: string) {
  if (typeof localStorage === 'undefined') return
  const current = readWorkoutActivity(sessionId)
  if (current) localStorage.removeItem(STORAGE_KEY)
}
