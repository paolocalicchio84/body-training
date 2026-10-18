import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useActiveSession, useFinishSession } from './useSessions'
import {
  clearWorkoutActivity,
  decideClock,
  readWorkoutActivity,
  writeWorkoutActivity,
} from './sessionClock'

type ClockValue = {
  elapsedSec: number
  promptOpen: boolean
}

const ClockContext = createContext<ClockValue>({
  elapsedSec: 0,
  promptOpen: false,
})

export function useWorkoutClock(): ClockValue {
  return useContext(ClockContext)
}

type Active = {
  id: string
  startedAt: string
  name: string
  notes: string | null
}

export function WorkoutClockProvider({ children }: { children: ReactNode }) {
  const { data: session } = useActiveSession()
  const active: Active | null = session
    ? {
        id: session.id,
        startedAt: session.started_at,
        name: session.name,
        notes: session.notes,
      }
    : null
  const activeRef = useRef(active)
  activeRef.current = active

  const [elapsedSec, setElapsedSec] = useState(0)
  const [promptOpen, setPromptOpen] = useState(false)
  const [suggestedSec, setSuggestedSec] = useState(60 * 60)

  const accRef = useRef(0)
  const lastRef = useRef(Date.now())
  const promptRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const current = activeRef.current
    if (!current) {
      promptRef.current = false
      sessionIdRef.current = null
      setPromptOpen(false)
      setElapsedSec(0)
      return
    }
    const now = Date.now()
    const decision = decideClock({
      sessionId: current.id,
      startedAtMs: new Date(current.startedAt).getTime(),
      nowMs: now,
      stored: readWorkoutActivity(current.id),
    })
    accRef.current = decision.accumulatedSec
    lastRef.current = now
    promptRef.current = decision.prompt
    sessionIdRef.current = current.id
    setElapsedSec(decision.accumulatedSec)
    setPromptOpen(decision.prompt)
    setSuggestedSec(decision.suggestedDurationSec)
    if (!decision.prompt) {
      writeWorkoutActivity({
        sessionId: current.id,
        accumulatedSec: decision.accumulatedSec,
        lastTickAt: now,
      })
    }
  }, [active?.id, active?.startedAt])

  useEffect(() => {
    if (!active?.id || promptOpen) return
    const sessionId = active.id
    const id = window.setInterval(() => {
      if (promptRef.current) return
      const now = Date.now()
      const add = Math.floor((now - lastRef.current) / 1000)
      if (add <= 0) return
      accRef.current += add
      lastRef.current += add * 1000
      setElapsedSec(accRef.current)
      writeWorkoutActivity({
        sessionId,
        accumulatedSec: accRef.current,
        lastTickAt: lastRef.current,
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [active?.id, promptOpen])

  useEffect(() => {
    function freeze() {
      const sessionId = sessionIdRef.current
      if (!sessionId || promptRef.current) return
      const now = Date.now()
      const add = Math.max(0, Math.floor((now - lastRef.current) / 1000))
      accRef.current += add
      lastRef.current = now
      writeWorkoutActivity({
        sessionId,
        accumulatedSec: accRef.current,
        lastTickAt: now,
      })
    }

    function resume() {
      const current = activeRef.current
      if (!current) return
      const now = Date.now()
      const decision = decideClock({
        sessionId: current.id,
        startedAtMs: new Date(current.startedAt).getTime(),
        nowMs: now,
        stored: readWorkoutActivity(current.id),
      })
      accRef.current = decision.accumulatedSec
      lastRef.current = now
      promptRef.current = decision.prompt
      setElapsedSec(decision.accumulatedSec)
      setPromptOpen(decision.prompt)
      setSuggestedSec(decision.suggestedDurationSec)
      if (!decision.prompt) {
        writeWorkoutActivity({
          sessionId: current.id,
          accumulatedSec: decision.accumulatedSec,
          lastTickAt: now,
        })
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') freeze()
      else resume()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', freeze)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', freeze)
    }
  }, [active?.id])

  function continueTraining() {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    const now = Date.now()
    lastRef.current = now
    promptRef.current = false
    setPromptOpen(false)
    setElapsedSec(accRef.current)
    writeWorkoutActivity({
      sessionId,
      accumulatedSec: accRef.current,
      lastTickAt: now,
    })
  }

  return (
    <ClockContext.Provider value={{ elapsedSec, promptOpen }}>
      {children}
      {active && promptOpen && (
        <StaleSessionDialog
          sessionId={active.id}
          name={active.name}
          notes={active.notes}
          suggestedSec={suggestedSec}
          onContinue={continueTraining}
        />
      )}
    </ClockContext.Provider>
  )
}

function StaleSessionDialog({
  sessionId,
  name,
  notes,
  suggestedSec,
  onContinue,
}: {
  sessionId: string
  name: string
  notes: string | null
  suggestedSec: number
  onContinue: () => void
}) {
  const finish = useFinishSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<'ask' | 'duration'>('ask')
  const [minutes, setMinutes] = useState(() =>
    String(Math.max(1, Math.round(suggestedSec / 60))),
  )
  const [noteDraft, setNoteDraft] = useState(notes ?? '')

  useEffect(() => {
    setStep('ask')
    setMinutes(String(Math.max(1, Math.round(suggestedSec / 60))))
    setNoteDraft(notes ?? '')
  }, [sessionId, suggestedSec, notes])

  async function closeSession() {
    const mins = Number(minutes)
    if (!Number.isFinite(mins) || mins < 1) {
      toast.error('Indica una durata di almeno 1 minuto')
      return
    }
    try {
      await finish.mutateAsync({
        sessionId,
        notes: noteDraft.trim() || null,
        durationSec: Math.round(mins * 60),
      })
      clearWorkoutActivity(sessionId)
      toast.success('Seduta chiusa')
      if (location.pathname.includes('/sessione')) navigate('/allenamento')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Impossibile chiudere la seduta',
      )
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Seduta ancora aperta</DialogTitle>
          <DialogDescription>
            «{name}» risulta ancora in corso. L&apos;app era chiusa, in
            background o ferma: quel tempo non viene contato come allenamento.
          </DialogDescription>
        </DialogHeader>

        {step === 'ask' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Stai ancora allenando, o la seduta è finita?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" onClick={onContinue}>
                Mi alleno ancora
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep('duration')}
              >
                Seduta finita
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conferma la durata reale. Il tempo in cui l&apos;app era ferma
              non è incluso. Puoi correggerla anche dopo, dallo storico.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="stale-duration">Durata (minuti)</Label>
              <Input
                id="stale-duration"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                aria-label="Durata in minuti"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stale-notes">Note</Label>
              <Textarea
                id="stale-notes"
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Note sulla seduta (opzionale)"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep('ask')}
              >
                Indietro
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={closeSession}
                disabled={finish.isPending}
              >
                Chiudi seduta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
