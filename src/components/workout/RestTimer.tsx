import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, SkipForward, Timer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatRemainingMs, initialRestMs } from '@/features/workout/rest'
import { cn } from '@/lib/utils'

type Props = {
  seconds: number
  onDone?: () => void
  /** Chiusura della barra: manuale con "Salta" o automatica a fine recupero. */
  onDismiss: () => void
}

const STEP_MS = 15_000
const AUTO_DISMISS_MS = 4_000

export function RestTimer({ seconds, onDone, onDismiss }: Props) {
  const initialMs = initialRestMs(seconds)
  const [totalMs, setTotalMs] = useState(initialMs)
  const [endAt, setEndAt] = useState(() => Date.now() + initialMs)
  const [remainingMs, setRemainingMs] = useState(initialMs)
  const [finished, setFinished] = useState(false)

  const onDoneRef = useRef(onDone)
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDoneRef.current = onDone
    onDismissRef.current = onDismiss
  })

  // Il residuo si ricalcola sempre da un timestamp di fine: con la scheda in
  // background il browser strozza gli interval e un contatore incrementale
  // perderebbe secondi.
  useEffect(() => {
    if (finished) return
    function tick() {
      const left = endAt - Date.now()
      setRemainingMs(left)
      if (left <= 0) setFinished(true)
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [endAt, finished])

  useEffect(() => {
    if (!finished) return
    if (typeof navigator.vibrate === 'function') navigator.vibrate([120, 80, 120])
    onDoneRef.current?.()
    const id = window.setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [finished])

  function shift(deltaMs: number) {
    if (finished) return
    setEndAt((prev) => Math.max(Date.now(), prev + deltaMs))
    setTotalMs((prev) => Math.max(1000, prev + deltaMs))
  }

  const progress = finished
    ? 0
    : Math.max(0, Math.min(1, remainingMs / totalMs))
  const almostDone = !finished && remainingMs <= 10_000

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card/95 backdrop-blur md:bottom-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
      aria-live="polite"
    >
      <div className="h-1 w-full bg-secondary">
        <div
          className={cn(
            'h-full transition-[width] duration-200 ease-linear',
            almostDone ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 md:px-8">
        <Timer
          className={cn(
            'h-5 w-5 shrink-0',
            finished ? 'text-primary' : 'text-muted-foreground',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {finished ? 'Recupero finito' : 'Recupero'}
          </div>
          <div
            className={cn(
              'font-mono text-2xl font-semibold tabular leading-tight',
              finished && 'text-primary',
              almostDone && 'text-warning',
            )}
          >
            {formatRemainingMs(finished ? 0 : remainingMs)}
          </div>
        </div>

        {!finished && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shift(-STEP_MS)}
              aria-label="Togli 15 secondi"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => shift(STEP_MS)}
              aria-label="Aggiungi 15 secondi"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button type="button" variant="secondary" onClick={onDismiss}>
          <SkipForward className="h-4 w-4" />
          {finished ? 'Chiudi' : 'Salta'}
        </Button>
      </div>
    </div>
  )
}
