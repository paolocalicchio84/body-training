import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Separator } from '@/components/ui/Separator'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ExerciseDemo } from '@/components/workout/ExerciseDemo'
import {
  useExercises,
  useUpdateExerciseVideoUrl,
} from '@/features/workout/useExercises'
import {
  useExerciseHistory,
  usePersonalRecords,
} from '@/features/workout/useWorkoutStats'
import {
  EQUIPMENT_LABELS,
  PATTERN_LABELS,
  PR_TYPE_LABELS,
  muscleLabel,
} from '@/features/workout/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: string | null
}

export function ExerciseDetail({ open, onOpenChange, exerciseId }: Props) {
  const {
    data: catalog = [],
    isLoading: catalogLoading,
    isError: catalogError,
  } = useExercises()

  const exercise = useMemo(
    () => catalog.find((e) => e.id === exerciseId) ?? null,
    [catalog, exerciseId],
  )

  const {
    data: history = [],
    isLoading: historyLoading,
    isError: historyError,
  } = useExerciseHistory(open ? exerciseId : null, 30)

  const {
    data: records = [],
    isError: recordsError,
  } = usePersonalRecords(open ? exerciseId : null)

  const updateVideo = useUpdateExerciseVideoUrl()
  const [videoDraft, setVideoDraft] = useState('')

  useEffect(() => {
    setVideoDraft(exercise?.video_url ?? '')
  }, [exercise?.id, exercise?.video_url, open])

  async function handleSaveVideo() {
    if (!exercise) return
    const next = videoDraft.trim() || null
    if (next === (exercise.video_url ?? null)) {
      toast.message('Nessuna modifica')
      return
    }
    try {
      await updateVideo.mutateAsync({
        id: exercise.id,
        video_url: next,
        isGlobal: exercise.user_id == null,
      })
      toast.success(next ? 'Demo collegata' : 'Demo rimossa')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Salvataggio fallito'
      toast.error(
        msg.includes('exercise_video_overrides') || msg.includes('schema cache')
          ? 'Esegui la migration 0015 su Supabase, poi riprova'
          : msg,
      )
    }
  }

  const chartData = useMemo(
    () =>
      history
        .filter((p) => p.est_1rm != null)
        .map((p) => ({
          label: format(parseISO(p.performed_at), 'd MMM', { locale: it }),
          est1rm: Number(p.est_1rm),
          weight: p.best_weight_kg != null ? Number(p.best_weight_kg) : null,
          reps: p.best_reps,
        })),
    [history],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{exercise?.name ?? 'Esercizio'}</DialogTitle>
          <DialogDescription>
            {exercise
              ? [
                  muscleLabel(exercise.primary_muscle),
                  EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment,
                  exercise.movement_pattern
                    ? (PATTERN_LABELS[exercise.movement_pattern] ??
                      exercise.movement_pattern)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Dettaglio esercizio'}
          </DialogDescription>
        </DialogHeader>

        {catalogError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Non è stato possibile caricare la libreria esercizi.
          </p>
        ) : catalogLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !exercise ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Esercizio non trovato: potrebbe essere stato archiviato.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Come si esegue
              </p>
              <ExerciseDemo
                exerciseName={exercise.name}
                aliases={exercise.aliases}
                videoUrl={exercise.video_url}
              />
              <div className="space-y-1.5">
                <Label htmlFor="exercise-video-url">
                  {exercise.video_url
                    ? 'La tua demo (sostituisce la GIF automatica)'
                    : 'Sostituisci demo (opzionale)'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="exercise-video-url"
                    type="url"
                    inputMode="url"
                    placeholder="Incolla YouTube / Shorts / GIF / MP4…"
                    value={videoDraft}
                    onChange={(e) => setVideoDraft(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleSaveVideo}
                    disabled={updateVideo.isPending}
                  >
                    {updateVideo.isPending ? '…' : 'Salva'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  GIF sbagliata? Incolla un link migliore e premi Salva: vale
                  solo per questo esercizio, in scheda e in seduta. Campo vuoto
                  + Salva = torna alla GIF automatica (o a YouTube search).
                </p>
                {exercise.video_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={updateVideo.isPending}
                    onClick={async () => {
                      setVideoDraft('')
                      try {
                        await updateVideo.mutateAsync({
                          id: exercise.id,
                          video_url: null,
                          isGlobal: exercise.user_id == null,
                        })
                        toast.success('Tornata la demo automatica')
                      } catch (err) {
                        const msg =
                          err instanceof Error
                            ? err.message
                            : 'Salvataggio fallito'
                        toast.error(
                          msg.includes('exercise_video_overrides') ||
                            msg.includes('schema cache')
                            ? 'Esegui la migration 0015 su Supabase, poi riprova'
                            : msg,
                        )
                      }
                    }}
                  >
                    Rimuovi il mio link
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {exercise.discouraged && (
              <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/5 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-medium text-warning">
                    Esercizio sconsigliato
                  </p>
                  {exercise.discouraged_reason && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exercise.discouraged_reason}
                    </p>
                  )}
                </div>
              </div>
            )}

            {exercise.secondary_muscles.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Muscoli secondari
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {exercise.secondary_muscles.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {muscleLabel(m)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {exercise.biomech_notes && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {exercise.biomech_notes}
              </p>
            )}

            {exercise.cues.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold">Cue di esecuzione</h4>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {exercise.cues.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {exercise.common_errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold">Errori comuni</h4>
                <ul className="mt-1.5 space-y-2">
                  {exercise.common_errors.map((e, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-background/50 p-2.5 text-xs"
                    >
                      <p className="font-medium">{e.error}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Causa: {e.cause}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        Correzione: {e.fix}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {exercise.contraindications && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                <p className="text-[10px] uppercase tracking-widest text-warning">
                  Controindicazioni
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {exercise.contraindications}
                </p>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="text-sm font-semibold">Massimale stimato</h4>
              {historyError ? (
                <p className="mt-2 text-sm text-destructive">
                  Non è stato possibile caricare lo storico di questo
                  esercizio.
                </p>
              ) : historyLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nessuna serie registrata con peso e ripetizioni per questo
                  esercizio.
                </p>
              ) : (
                <div className="mt-2 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={42}
                        domain={['dataMin - 5', 'dataMax + 5']}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        formatter={(v) => [`${v} kg`, '1RM stimato']}
                      />
                      <Line
                        type="monotone"
                        dataKey="est1rm"
                        name="1RM stimato"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold">Record personali</h4>
              {recordsError ? (
                <p className="mt-2 text-sm text-destructive">
                  Non è stato possibile caricare i record di questo esercizio.
                </p>
              ) : records.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nessun record registrato.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {records.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-background/50 px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">
                        {PR_TYPE_LABELS[r.record_type]}
                      </span>
                      <span className="font-mono text-sm tabular font-semibold">
                        {Number(r.value)}
                        {r.weight_kg != null && r.reps != null && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {Number(r.weight_kg)} × {r.reps}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(parseISO(r.achieved_at), 'd MMM yyyy', {
                          locale: it,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
