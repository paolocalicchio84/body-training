import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Loader2,
  MoreVertical,
  PlayCircle,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ExercisePickerDialog } from '@/components/workout/ExercisePickerDialog'
import { RestTimer } from '@/components/workout/RestTimer'
import { DemoBadge } from '@/components/workout/ExerciseDemo'
import { ExerciseDetail } from './ExerciseDetail'
import { resolveExerciseDemoUrl } from '@/lib/exercise-media'
import { cn } from '@/lib/utils'
import { useExercise } from '@/features/workout/useExercises'
import { useRoutine } from '@/features/workout/useRoutines'
import { useWorkoutClock } from '@/features/workout/WorkoutClock'
import {
  formatRestClock,
  resolveRestSeconds,
  routineRestForExercise,
} from '@/features/workout/rest'
import {
  useActiveSession,
  useAddSessionExercise,
  useAddSet,
  useDeleteSet,
  useDiscardSession,
  useFinishSession,
  useLastPerformance,
  useRemoveSessionExercise,
  useUpdateSessionMeta,
  useUpdateExerciseNote,
  type DetectedPr,
  useUpdateSet,
  type SetPatch,
} from '@/features/workout/useSessions'
import {
  SET_TYPE_BADGE,
  SET_TYPE_LABELS,
  formatDuration,
  formatVolume,
  muscleLabel,
} from '@/features/workout/types'
import type {
  Exercise,
  LastPerformance,
  RoutineExercise,
  SessionExercise,
  SessionSet,
  SessionWithExercises,
  SetType,
} from '@/features/workout/types'
const EDITABLE_SET_TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure']

const PR_TYPE_SHORT: Record<DetectedPr['record_type'], string> = {
  est_1rm: 'massimale stimato',
  max_weight: 'carico massimo',
  max_set_volume: 'volume su serie',
  max_reps: 'ripetizioni massime',
}

// Griglia condivisa fra intestazione e righe: le colonne devono restare
// allineate anche quando la colonna "Precedente" è vuota.
const SET_GRID =
  'grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_4rem_2.75rem] items-center gap-1.5 sm:gap-2'

function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function toInputValue(n: number | null): string {
  return n == null ? '' : String(n)
}

function parseDecimal(raw: string): number | null {
  const v = raw.trim().replace(',', '.')
  if (!v) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

function parseInteger(raw: string): number | null {
  const n = parseDecimal(raw)
  return n == null ? null : Math.round(n)
}

function formatSetSummary(
  weightKg: number | null,
  reps: number | null,
): string | null {
  if (weightKg != null && reps != null) return `${weightKg}kg × ${reps}`
  if (weightKg != null) return `${weightKg}kg`
  if (reps != null) return `${reps} rip`
  return null
}

function computeTotals(session: SessionWithExercises) {
  let volumeKg = 0
  let completedSets = 0
  for (const se of session.session_exercises) {
    for (const s of se.session_sets) {
      // Il riscaldamento non entra né nel volume né nel conteggio serie.
      if (!s.completed || s.set_type === 'warmup') continue
      completedSets += 1
      if (s.weight_kg != null && s.reps != null) {
        volumeKg += s.weight_kg * s.reps
      }
    }
  }
  return { volumeKg, completedSets }
}

export function ActiveSession() {
  const navigate = useNavigate()
  const { data: session, isLoading, isError, error } = useActiveSession()
  const { elapsedSec } = useWorkoutClock()
  const { data: routine } = useRoutine(session?.routine_id ?? null)

  const exerciseIds = useMemo(
    () => [
      ...new Set(
        (session?.session_exercises ?? []).map((se) => se.exercise_id),
      ),
    ],
    [session],
  )
  const { data: lastPerformance } = useLastPerformance(exerciseIds)

  const totals = useMemo(
    () => (session ? computeTotals(session) : { volumeKg: 0, completedSets: 0 }),
    [session],
  )

  const addExercise = useAddSessionExercise()
  const finish = useFinishSession()
  const discard = useDiscardSession()

  const [rest, setRest] = useState<{ key: number; seconds: number } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [sessionRpe, setSessionRpe] = useState<number | null>(null)
  const [finishNotes, setFinishNotes] = useState('')

  function startRest(seconds: number) {
    setRest({ key: Date.now(), seconds })
  }

  async function handleAddExercises(exercises: Exercise[]) {
    if (!session) return
    const basePosition =
      session.session_exercises.reduce((max, se) => Math.max(max, se.position), -1) +
      1
    try {
      for (let i = 0; i < exercises.length; i += 1) {
        await addExercise.mutateAsync({
          sessionId: session.id,
          exerciseId: exercises[i].id,
          position: basePosition + i,
        })
      }
      toast.success(
        exercises.length === 1
          ? 'Esercizio aggiunto'
          : `${exercises.length} esercizi aggiunti`,
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Impossibile aggiungere gli esercizi',
      )
    }
  }

  async function handleFinish() {
    if (!session) return
    try {
      const { prs } = await finish.mutateAsync({
        sessionId: session.id,
        notes: finishNotes.trim() || null,
        sessionRpe,
        durationSec: elapsedSec,
      })
      setFinishOpen(false)
      for (const pr of prs) {
        const summary =
          formatSetSummary(pr.weight_kg, pr.reps) ?? `${pr.value}`
        toast.success(`🏆 Nuovo record: ${pr.exercise_name} ${summary}`, {
          description: PR_TYPE_SHORT[pr.record_type],
          duration: 7000,
        })
      }
      toast.success('Allenamento completato')
      navigate('/allenamento')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Impossibile terminare la sessione',
      )
    }
  }

  async function handleDiscard() {
    if (!session) return
    try {
      await discard.mutateAsync(session.id)
      setDiscardOpen(false)
      toast.success('Allenamento scartato')
      navigate('/allenamento')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Impossibile scartare la sessione',
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              Non riesco a caricare l'allenamento
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : 'Errore di rete o database non raggiungibile.'}
          </p>
          <Button type="button" variant="outline" onClick={() => navigate(0)}>
            Riprova
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nessun allenamento in corso</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Avvia una sessione da una scheda o parti con un allenamento libero.
            </p>
          </div>
          <Button type="button" onClick={() => navigate('/allenamento')}>
            Vai agli allenamenti
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-4', rest ? 'pb-40 md:pb-28' : 'pb-24 md:pb-8')}>
      <div className="sticky top-14 z-10 space-y-3 rounded-lg border border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex items-center gap-1 sm:gap-2">
          <SessionNameInput sessionId={session.id} name={session.name} />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDiscardOpen(true)}
            className="shrink-0 px-3 text-destructive hover:bg-destructive/10"
          >
            Scarta
          </Button>
          <Button
            type="button"
            onClick={() => setFinishOpen(true)}
            className="shrink-0 px-3"
          >
            <CheckCircle2 className="h-4 w-4" />
            Termina
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Durata" value={formatClock(elapsedSec)} />
          <Stat label="Volume" value={formatVolume(totals.volumeKg)} />
          <Stat label="Serie" value={String(totals.completedSets)} />
        </div>
      </div>

      {session.session_exercises.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessun esercizio nella sessione. Aggiungine uno per iniziare a
            registrare le serie.
          </CardContent>
        </Card>
      ) : (
        session.session_exercises.map((se) => (
          <ExerciseCard
            key={se.id}
            sessionExercise={se}
            routineExercises={routine?.routine_exercises}
            last={lastPerformance?.get(se.exercise_id)}
            onRest={startRest}
          />
        ))
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => setPickerOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Aggiungi esercizio
      </Button>

      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddExercises}
        multiple
      />

      {rest && (
        <RestTimer
          key={rest.key}
          seconds={rest.seconds}
          onDismiss={() => setRest(null)}
        />
      )}

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termina allenamento</DialogTitle>
            <DialogDescription>
              Le serie non completate vengono scartate al salvataggio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Durata" value={formatDuration(elapsedSec)} />
            <Stat label="Volume" value={formatVolume(totals.volumeKg)} />
            <Stat label="Serie" value={String(totals.completedSets)} />
            <Stat
              label="Esercizi"
              value={String(session.session_exercises.length)}
            />
          </div>

          <div className="space-y-2">
            <Label>Sforzo percepito (RPE)</Label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSessionRpe(sessionRpe === n ? null : n)}
                  className={cn(
                    'h-11 rounded-md border border-border font-mono text-sm tabular transition-colors',
                    sessionRpe === n
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="finish_notes">Note (opz.)</Label>
            <Textarea
              id="finish_notes"
              rows={3}
              value={finishNotes}
              onChange={(e) => setFinishNotes(e.target.value)}
              placeholder="es. buona sessione, spalla ok, panca pesante"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setFinishOpen(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleFinish}
              disabled={finish.isPending}
            >
              {finish.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {finish.isPending ? 'Salvataggio…' : 'Termina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scartare l'allenamento?</DialogTitle>
            <DialogDescription>
              La sessione e tutte le serie registrate finora vengono eliminate
              definitivamente. L'operazione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setDiscardOpen(false)}
            >
              Continua ad allenarti
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={handleDiscard}
              disabled={discard.isPending}
            >
              {discard.isPending ? 'Elimino…' : 'Scarta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-lg font-semibold tabular leading-tight">
        {value}
      </div>
    </div>
  )
}

function SessionNameInput({
  sessionId,
  name,
}: {
  sessionId: string
  name: string
}) {
  const updateMeta = useUpdateSessionMeta()
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])

  function commit() {
    const next = draft.trim()
    if (!next) {
      setDraft(name)
      return
    }
    if (next === name) return
    updateMeta.mutate(
      { id: sessionId, patch: { name: next } },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'Nome non salvato',
          ),
      },
    )
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      aria-label="Nome allenamento"
      className="h-10 border-transparent bg-transparent px-2 text-base font-semibold focus-visible:border-input focus-visible:bg-background"
    />
  )
}

function ExerciseCard({
  sessionExercise,
  routineExercises,
  last,
  onRest,
}: {
  sessionExercise: SessionExercise
  routineExercises: RoutineExercise[] | undefined
  last: LastPerformance | undefined
  onRest: (seconds: number) => void
}) {
  const cachedExercise = useExercise(sessionExercise.exercise_id)
  // Preferisci catalogo (con override video utente) rispetto al join sessione.
  const exercise = useMemo(() => {
    const joined = sessionExercise.exercise
    if (cachedExercise) {
      return joined
        ? { ...joined, video_url: cachedExercise.video_url }
        : cachedExercise
    }
    return joined ?? null
  }, [sessionExercise.exercise, cachedExercise])
  const [detailOpen, setDetailOpen] = useState(false)
  const hasDemo = Boolean(
    exercise &&
      resolveExerciseDemoUrl({
        videoUrl: exercise.video_url,
        name: exercise.name,
        aliases: exercise.aliases,
      }),
  )

  const addSet = useAddSet()
  const updateSet = useUpdateSet()
  const deleteSet = useDeleteSet()
  const removeExercise = useRemoveSessionExercise()
  const updateNote = useUpdateExerciseNote()

  const [menuOpen, setMenuOpen] = useState(false)
  const [cuesOpen, setCuesOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(sessionExercise.notes ?? '')
  const [optionsSetId, setOptionsSetId] = useState<string | null>(null)

  const sets = sessionExercise.session_sets
  const optionsSet = sets.find((s) => s.id === optionsSetId) ?? null

  function patchSet(id: string, patch: SetPatch) {
    updateSet.mutate(
      { id, patch },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'Modifica non salvata',
          ),
      },
    )
  }

  const restSec = resolveRestSeconds(
    routineRestForExercise(sessionExercise, routineExercises),
    exercise?.default_rest_sec,
  )

  function handleToggle(set: SessionSet) {
    const completed = !set.completed
    patchSet(set.id, { completed })
    if (completed) onRest(restSec)
  }

  function handleAddSet() {
    const source = [...sets].reverse().find((s) => s.set_type !== 'warmup')
    const lastSet = sets[sets.length - 1]
    addSet.mutate(
      {
        sessionExerciseId: sessionExercise.id,
        position: (lastSet?.position ?? -1) + 1,
        weightKg: source?.weight_kg ?? null,
        reps: source?.reps ?? null,
      },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'Serie non aggiunta',
          ),
      },
    )
  }

  function handleRemoveExercise() {
    setMenuOpen(false)
    removeExercise.mutate(sessionExercise.id, {
      onSuccess: () => toast.success('Esercizio rimosso'),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : 'Esercizio non rimosso',
        ),
    })
  }

  function handleSaveNote() {
    updateNote.mutate(
      { id: sessionExercise.id, notes: noteDraft.trim() || null },
      {
        onSuccess: () => {
          setNoteOpen(false)
          toast.success('Nota salvata')
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Nota non salvata'),
      },
    )
  }

  // Numerazione visibile solo per le serie normali: le altre mostrano la sigla
  // del tipo (R, D, C…).
  let workIndex = 0

  // "Precedente" va allineata per posizione fra le sole serie allenanti:
  // confrontare per indice assoluto sfaserebbe tutto non appena il numero
  // di riscaldamenti cambia da una seduta all'altra.
  const previousWorkSets = (last?.sets ?? []).filter(
    (s) => s.set_type !== 'warmup',
  )
  let previousIndex = -1

  return (
    <Card>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="relative flex items-start gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 rounded-md text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setDetailOpen(true)}
          >
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold">
                {exercise?.name ?? 'Esercizio'}
              </h3>
              <DemoBadge hasDemo={hasDemo} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {exercise ? muscleLabel(exercise.primary_muscle) : '—'}
              {last && ` · ultima volta ${last.sets.length} serie`}
              {' · Recupero '}
              {formatRestClock(restSec)}
              {' · '}
              <span className="text-primary/80">demo / dettaglio</span>
            </p>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDetailOpen(true)}
            aria-label="Apri demo esercizio"
            title="Demo / dettaglio"
          >
            <PlayCircle className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Opzioni esercizio"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>

          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 cursor-default"
                aria-label="Chiudi menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-secondary"
                  onClick={() => {
                    setMenuOpen(false)
                    setDetailOpen(true)
                  }}
                >
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  Demo / come si esegue
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-secondary"
                  onClick={() => {
                    setNoteDraft(sessionExercise.notes ?? '')
                    setMenuOpen(false)
                    setNoteOpen(true)
                  }}
                >
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  {sessionExercise.notes ? 'Modifica nota' : 'Aggiungi nota'}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10"
                  onClick={handleRemoveExercise}
                >
                  <Trash2 className="h-4 w-4" />
                  Rimuovi esercizio
                </button>
              </div>
            </>
          )}
        </div>

        {sessionExercise.notes && (
          <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
            {sessionExercise.notes}
          </p>
        )}

        {exercise?.discouraged && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-warning">
              {exercise.discouraged_reason ??
                'Esercizio sconsigliato: valuta un’alternativa più sicura.'}
            </p>
          </div>
        )}

        {exercise && exercise.cues.length > 0 && (
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setCuesOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
              aria-expanded={cuesOpen}
            >
              Come si esegue
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  cuesOpen && 'rotate-180',
                )}
              />
            </button>
            {cuesOpen && (
              <ul className="space-y-1.5 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
                {exercise.cues.map((cue, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div
            className={cn(
              SET_GRID,
              'px-1 text-[10px] uppercase tracking-widest text-muted-foreground',
            )}
          >
            <span className="text-center">#</span>
            <span>Precedente</span>
            <span className="text-center">kg</span>
            <span className="text-center">reps</span>
            <span className="text-center">
              <Check className="mx-auto h-3.5 w-3.5" />
            </span>
          </div>

          {sets.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Nessuna serie. Aggiungine una qui sotto.
            </p>
          )}

          {sets.map((set) => {
            if (set.set_type === 'normal') workIndex += 1
            const isWarmup = set.set_type === 'warmup'
            if (!isWarmup) previousIndex += 1
            return (
              <SetRow
                key={set.id}
                set={set}
                label={SET_TYPE_BADGE[set.set_type] || String(workIndex)}
                previous={isWarmup ? undefined : previousWorkSets[previousIndex]}
                onPatch={(patch) => patchSet(set.id, patch)}
                onToggle={() => handleToggle(set)}
                onOptions={() => setOptionsSetId(set.id)}
              />
            )
          })}
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleAddSet}
          disabled={addSet.isPending}
        >
          <Plus className="h-4 w-4" />
          Serie
        </Button>
      </CardContent>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nota esercizio</DialogTitle>
            <DialogDescription>
              {exercise?.name ?? 'Esercizio'} — visibile solo in questa sessione.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="es. presa larga, fermo di 1s in basso"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setNoteOpen(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSaveNote}
              disabled={updateNote.isPending}
            >
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={optionsSet !== null}
        onOpenChange={(open) => !open && setOptionsSetId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Opzioni serie</DialogTitle>
            <DialogDescription>
              Cambia il tipo di serie o eliminala dalla sessione.
            </DialogDescription>
          </DialogHeader>
          {optionsSet && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {EDITABLE_SET_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      patchSet(optionsSet.id, { set_type: type })
                      setOptionsSetId(null)
                    }}
                    className={cn(
                      'h-12 rounded-md border border-border px-3 text-sm transition-colors',
                      optionsSet.set_type === type
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-secondary',
                    )}
                  >
                    {SET_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => {
                  deleteSet.mutate(optionsSet.id, {
                    onError: (err) =>
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : 'Serie non eliminata',
                      ),
                  })
                  setOptionsSetId(null)
                }}
              >
                <Trash2 className="h-4 w-4" />
                Elimina serie
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ExerciseDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        exerciseId={sessionExercise.exercise_id}
      />
    </Card>
  )
}

function SetRow({
  set,
  label,
  previous,
  onPatch,
  onToggle,
  onOptions,
}: {
  set: SessionSet
  label: string
  previous: LastPerformance['sets'][number] | undefined
  onPatch: (patch: SetPatch) => void
  onToggle: () => void
  onOptions: () => void
}) {
  const [weight, setWeight] = useState(() => toInputValue(set.weight_kg))
  const [reps, setReps] = useState(() => toInputValue(set.reps))

  // L'update è ottimistico: quando il valore in cache cambia (copia dalla
  // colonna "Precedente", rollback su errore) l'input deve riallinearsi.
  useEffect(() => setWeight(toInputValue(set.weight_kg)), [set.weight_kg])
  useEffect(() => setReps(toInputValue(set.reps)), [set.reps])

  const previousLabel = previous
    ? formatSetSummary(previous.weight_kg, previous.reps)
    : null

  function commitWeight() {
    const value = parseDecimal(weight)
    if (value === set.weight_kg) return
    onPatch({ weight_kg: value })
  }

  function commitReps() {
    const value = parseInteger(reps)
    if (value === set.reps) return
    onPatch({ reps: value })
  }

  return (
    <div
      className={cn(
        SET_GRID,
        'rounded-md px-1 py-1',
        set.completed && 'bg-primary/10',
      )}
    >
      <button
        type="button"
        onClick={onOptions}
        aria-label={`Opzioni serie ${label}`}
        className={cn(
          'h-10 rounded-md font-mono text-sm tabular transition-colors hover:bg-secondary',
          set.set_type === 'warmup' ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        {label}
      </button>

      <button
        type="button"
        disabled={!previous}
        onClick={() =>
          previous &&
          onPatch({ weight_kg: previous.weight_kg, reps: previous.reps })
        }
        title={previousLabel ? 'Copia i valori precedenti' : undefined}
        className="h-10 truncate rounded-md px-1 text-left font-mono text-xs tabular text-muted-foreground transition-colors enabled:hover:bg-secondary disabled:opacity-60"
      >
        {previousLabel ?? '—'}
      </button>

      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commitWeight}
        placeholder={previous?.weight_kg != null ? String(previous.weight_kg) : '—'}
        aria-label={`Peso serie ${label}`}
        className="h-10 px-2 text-center font-mono text-sm tabular"
      />

      <Input
        type="number"
        inputMode="numeric"
        step="1"
        min="0"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commitReps}
        placeholder={previous?.reps != null ? String(previous.reps) : '—'}
        aria-label={`Ripetizioni serie ${label}`}
        className="h-10 px-2 text-center font-mono text-sm tabular"
      />

      <button
        type="button"
        onClick={onToggle}
        aria-label={
          set.completed ? `Annulla serie ${label}` : `Completa serie ${label}`
        }
        aria-pressed={set.completed}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-md border transition-colors',
          set.completed
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border text-muted-foreground hover:bg-secondary',
        )}
      >
        <Check className="h-5 w-5" />
      </button>
    </div>
  )
}
