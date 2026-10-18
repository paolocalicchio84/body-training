import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SENSIBLE_DURATION_SEC,
  STALE_GAP_MS,
  decideClock,
  suggestedDurationSec,
} from './sessionClock.ts'

const SESSION = 'active1'
const HOUR = 3600 * 1000

describe('cronometro seduta e buco di inattività', () => {
  it('un buco lungo non entra nel tempo contato', () => {
    const started = 1_000_000
    const stored = {
      sessionId: SESSION,
      accumulatedSec: 40 * 60,
      lastTickAt: started + 40 * 60 * 1000,
    }
    const now = stored.lastTickAt + 18 * HOUR
    const decision = decideClock({
      sessionId: SESSION,
      startedAtMs: started,
      nowMs: now,
      stored,
    })
    assert.equal(decision.prompt, true)
    assert.equal(decision.accumulatedSec, 40 * 60)
    assert.equal(decision.suggestedDurationSec, 40 * 60)
    assert.ok(decision.suggestedDurationSec < (now - started) / 1000)
  })

  it('senza battito, una seduta di molte ore propone un\'ora non il wall clock', () => {
    const started = 1_000_000
    const now = started + 18 * HOUR
    const decision = decideClock({
      sessionId: SESSION,
      startedAtMs: started,
      nowMs: now,
      stored: null,
    })
    assert.equal(decision.prompt, true)
    assert.equal(decision.accumulatedSec, 0)
    assert.equal(decision.suggestedDurationSec, SENSIBLE_DURATION_SEC)
    assert.equal(
      suggestedDurationSec({ wallSec: 18 * 3600, accumulatedSec: null }),
      SENSIBLE_DURATION_SEC,
    )
  })

  it('una pausa breve non apre il prompt e resta nel tempo contato', () => {
    const started = 1_000_000
    const stored = {
      sessionId: SESSION,
      accumulatedSec: 600,
      lastTickAt: started + 600_000,
    }
    const now = stored.lastTickAt + 20_000
    assert.ok(20_000 < STALE_GAP_MS)
    const decision = decideClock({
      sessionId: SESSION,
      startedAtMs: started,
      nowMs: now,
      stored,
    })
    assert.equal(decision.prompt, false)
    assert.equal(decision.accumulatedSec, 620)
  })

  it('una seduta appena partita non è considerata abbandonata', () => {
    const started = 5_000_000
    const decision = decideClock({
      sessionId: SESSION,
      startedAtMs: started,
      nowMs: started + 30_000,
      stored: null,
    })
    assert.equal(decision.prompt, false)
    assert.equal(decision.accumulatedSec, 30)
  })
})
