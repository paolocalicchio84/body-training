import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Loader2, PlayCircle, Plus, Save, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Separator } from '@/components/ui/Separator'
import { ExercisePickerDialog } from '@/components/workout/ExercisePickerDialog'
import { DemoBadge } from '@/components/workout/ExerciseDemo'
import { ExerciseDetail } from './ExerciseDetail'
import { useExercises } from '@/features/workout/useExercises'
import { resolveExerciseDemoUrl } from '@/lib/exercise-media'
import {
  useCreateRoutine,
  useRoutine,
  useUpdateRoutine,
  type RoutineExerciseInput,
} from '@/features/workout/useRoutines'
import {
  MUSCLE_ORDER,
  WEEKDAY_LABELS,
  muscleLabel,
  type Exercise,
} from '@/features/workout/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  routineId?: string | null
}

type EditorRow = {
  key: string
  exerciseId: string
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  targetSets: string
  repMin: string
  repMax: string
  targetRpe: string
  restSec: string
  notes: string
}

let rowCounter = 0
function nextKey() {
  rowCounter += 1
  return `row-${rowCounter}`
}

function toNum(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function rowFromExercise(ex: Exercise): EditorRow {
  return {
    key: nextKey(),
    exerciseId: ex.id,
    name: ex.name,
    primaryMuscle: ex.primary_muscle,
    secondaryMuscles: ex.secondary_muscles,
    targetSets: '3',
    repMin: '8',
    repMax: '12',
    targetRpe: '',
    restSec: ex.default_rest_sec != null ? String(ex.default_rest_sec) : '120',
    notes: '',
  }
}

export function RoutineEditor({ open, onOpenChange, routineId }: Props) {
  const {
    data: routine,
    isLoading,
    isError,
  } = useRoutine(open && routineId ? routineId : null)

  const create = useCreateRoutine()
  const update = useUpdateRoutine()
  const { data: catalog = [] } = useExercises()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [weekday, setWeekday] = useState('none')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<EditorRow[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Il form si precompila una sola volta per apertura: un refetch della
  // query non deve sovrascrivere le modifiche in corso.
  const loadedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      loadedRef.current = null
      return
    }
    const key = routineId ?? 'new'
    if (loadedRef.current === key) return

    if (!routineId) {
      loadedRef.current = key
      setName('')
      setDescription('')
      setWeekday('none')
      setNotes('')
      setRows([])
      return
    }
    if (!routine) return
    loadedRef.current = key
    setName(routine.name)
    setDescription(routine.description ?? '')
    setWeekday(routine.weekday != null ? String(routine.weekday) : 'none')
    setNotes(routine.notes ?? '')
    setRows(
      routine.routine_exercises.map((re) => ({
        key: nextKey(),
        exerciseId: re.exercise_id,
        name: re.exercise?.name ?? 'Esercizio',
        primaryMuscle: re.exercise?.primary_muscle ?? '',
        secondaryMuscles: re.exercise?.secondary_muscles ?? [],
        targetSets: String(re.target_sets),
        repMin: re.rep_min != null ? String(re.rep_min) : '',
        repMax: re.rep_max != null ? String(re.rep_max) : '',
        targetRpe: re.target_rpe != null ? String(re.target_rpe) : '',
        restSec: re.rest_sec != null ? String(re.rest_sec) : '',
        notes: re.notes ?? '',
      })),
    )
  }, [open, routineId, routine])

  // Serie settimanali della scheda: primario 1, secondari 0,5.
  const volumeChips = useMemo(() => {
    const totals = new Map<string, number>()
    for (const r of rows) {
      const sets = toNum(r.targetSets) ?? 0
      if (sets <= 0) continue
      if (r.primaryMuscle) {
        totals.set(r.primaryMuscle, (totals.get(r.primaryMuscle) ?? 0) + sets)
      }
      for (const m of r.secondaryMuscles) {
        totals.set(m, (totals.get(m) ?? 0) + sets * 0.5)
      }
    }
    return [...totals.entries()]
      .sort((a, b) => {
        const ia = MUSCLE_ORDER.indexOf(a[0])
        const ib = MUSCLE_ORDER.indexOf(b[0])
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
      })
      .map(([muscle, sets]) => ({ muscle, sets }))
  }, [rows])

  function patchRow(key: string, patch: Partial<EditorRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    )
  }

  function moveRow(index: number, delta: number) {
    setRows((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  function addExercises(exercises: Exercise[]) {
    setRows((prev) => [...prev, ...exercises.map(rowFromExercise)])
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Dai un nome alla scheda')
      return
    }
    if (rows.length === 0) {
      toast.error('Aggiungi almeno un esercizio')
      return
    }

    const exercises: RoutineExerciseInput[] = rows.map((r, i) => ({
      exercise_id: r.exerciseId,
      position: i,
      // Il CHECK del DB accetta 1-20: clampiamo qui perché un valore fuori
      // range farebbe fallire l'insert dopo che la delete è già passata.
      target_sets: Math.min(20, Math.max(1, toNum(r.targetSets) ?? 3)),
      rep_min: toNum(r.repMin),
      rep_max: toNum(r.repMax),
      target_rpe: toNum(r.targetRpe),
      rest_sec: toNum(r.restSec),
      notes: r.notes.trim() || null,
    }))

    const weekdayValue = weekday === 'none' ? null : Number(weekday)

    try {
      if (routineId) {
        await update.mutateAsync({
          id: routineId,
          patch: {
            name: trimmed,
            description: description.trim() || null,
            notes: notes.trim() || null,
            weekday: weekdayValue,
          },
          exercises,
        })
        toast.success('Scheda aggiornata')
      } else {
        await create.mutateAsync({
          name: trimmed,
          description: description.trim() || null,
          notes: notes.trim() || null,
          weekday: weekdayValue,
          exercises,
        })
        toast.success('Scheda creata')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
          <DialogHeader className="shrink-0 p-4 pb-3 pr-10 sm:p-6 sm:pb-3">
            <DialogTitle>
              {routineId ? 'Modifica scheda' : 'Nuova scheda'}
            </DialogTitle>
            <DialogDescription>
              Definisci gli esercizi, le serie e i range di ripetizioni. Il
              riquadro volume in fondo ti dice subito quanto carichi ogni gruppo.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
          {isError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Non è stato possibile caricare la scheda. Chiudi e riprova.
            </p>
          ) : isLoading && routineId ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="routine-name">Nome</Label>
                  <Input
                    id="routine-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="es. Upper A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="routine-weekday">Giorno della settimana</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger id="routine-weekday">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {Object.entries(WEEKDAY_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="routine-desc">Descrizione</Label>
                <Input
                  id="routine-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="es. spinte pesanti + richiamo dorso"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="routine-notes">Note</Label>
                <Textarea
                  id="routine-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Indicazioni da ricordare durante la seduta"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">
                    Esercizi ({rows.length})
                  </h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Aggiungi esercizio
                  </Button>
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nessun esercizio. Aggiungine almeno uno per salvare la
                    scheda.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {rows.map((r, i) => (
                      <li
                        key={r.key}
                        className="rounded-md border border-border bg-background/50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            className="min-w-0 flex-1 rounded-md text-left hover:bg-secondary/50"
                            onClick={() => setDetailId(r.exerciseId)}
                          >
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {i + 1}. {r.name}
                              </p>
                              <DemoBadge
                                hasDemo={Boolean(
                                  (() => {
                                    const ex = catalog.find(
                                      (e) => e.id === r.exerciseId,
                                    )
                                    if (!ex) return false
                                    return resolveExerciseDemoUrl({
                                      videoUrl: ex.video_url,
                                      name: ex.name,
                                      aliases: ex.aliases,
                                    })
                                  })(),
                                )}
                              />
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {muscleLabel(r.primaryMuscle)}
                              {' · '}
                              <span className="text-primary/80">demo</span>
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setDetailId(r.exerciseId)}
                              aria-label="Apri demo"
                              title="Demo / dettaglio"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => moveRow(i, -1)}
                              disabled={i === 0}
                              aria-label="Sposta su"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => moveRow(i, 1)}
                              disabled={i === rows.length - 1}
                              aria-label="Sposta giù"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setRows((prev) =>
                                  prev.filter((x) => x.key !== r.key),
                                )
                              }
                              aria-label="Rimuovi esercizio"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                          <NumberField
                            label="Serie"
                            value={r.targetSets}
                            min={1}
                            onChange={(v) => patchRow(r.key, { targetSets: v })}
                          />
                          <NumberField
                            label="Rep min"
                            value={r.repMin}
                            min={1}
                            onChange={(v) => patchRow(r.key, { repMin: v })}
                          />
                          <NumberField
                            label="Rep max"
                            value={r.repMax}
                            min={1}
                            onChange={(v) => patchRow(r.key, { repMax: v })}
                          />
                          <NumberField
                            label="RPE"
                            value={r.targetRpe}
                            min={1}
                            max={10}
                            step={0.5}
                            onChange={(v) => patchRow(r.key, { targetRpe: v })}
                          />
                          <NumberField
                            label="Recupero (s)"
                            value={r.restSec}
                            min={0}
                            step={15}
                            onChange={(v) => patchRow(r.key, { restSec: v })}
                          />
                        </div>

                        <Input
                          className="mt-2 h-8 text-xs"
                          value={r.notes}
                          onChange={(e) =>
                            patchRow(r.key, { notes: e.target.value })
                          }
                          placeholder="Note (es. presa stretta, tempo 3-1-1)"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-md border border-border bg-card/50 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Volume della scheda
                </p>
                {volumeChips.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Aggiungi esercizi per vedere le serie per gruppo muscolare.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {volumeChips.map(({ muscle, sets }) => (
                      <span
                        key={muscle}
                        className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {muscleLabel(muscle)}{' '}
                        <span className="font-mono tabular text-foreground">
                          {sets % 1 === 0 ? sets : sets.toFixed(1)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Il muscolo primario conta 1 serie, i secondari 0,5.
                </p>
              </div>

            </div>
          )}
          </div>

          {/* Footer fisso: con una scheda da otto esercizi il pulsante di
              salvataggio sarebbe altrimenti a schermate di distanza. */}
          <div
            className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-4 sm:p-6"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salva scheda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExercisePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={addExercises}
        multiple
        title="Aggiungi esercizi alla scheda"
      />

      <ExerciseDetail
        open={!!detailId}
        onOpenChange={(o) => {
          if (!o) setDetailId(null)
        }}
        exerciseId={detailId}
      />
    </>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        className="h-8 text-sm"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
