import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatRemainingMs,
  formatRestClock,
  formatRestMinutes,
  initialRestMs,
  resolveRestSeconds,
  routineRestForExercise,
} from './rest.ts'

describe('recupero: secondi salvati e timer', () => {
  it('120 secondi (2 minuti) restano 2 minuti sul timer', () => {
    assert.equal(initialRestMs(120), 120_000)
    assert.equal(formatRemainingMs(120_000), '02:00')
    assert.equal(formatRestClock(120), '02:00')
    assert.equal(formatRestMinutes(120), '2 min')
  })

  it('la scheda vince sul default del catalogo', () => {
    // Panca: catalogo 180s, scheda impostata a 2 minuti.
    assert.equal(resolveRestSeconds(120, 180), 120)
    assert.equal(resolveRestSeconds(null, 180), 180)
    assert.equal(resolveRestSeconds(undefined, null), 120)
  })

  it('abbina il recupero della scheda per posizione ed esercizio', () => {
    const rows = [
      { position: 0, exercise_id: 'e1', rest_sec: 120 },
      { position: 1, exercise_id: 'e6', rest_sec: 150 },
    ]
    assert.equal(
      routineRestForExercise({ position: 0, exercise_id: 'e1' }, rows),
      120,
    )
    assert.equal(
      resolveRestSeconds(
        routineRestForExercise({ position: 0, exercise_id: 'e1' }, rows),
        180,
      ),
      120,
    )
  })
})
