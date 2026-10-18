import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useDeleteSession, useSession, useSessions, useUpdateCompletedSession } from '@/features/workout/useSessions'
import {
  SET_TYPE_LABELS,
  formatDuration,
  formatVolume,
  muscleLabel,
} from '@/features/workout/types'
import type { WorkoutSession } from '@/features/workout/types'

export function HistoryTab() {
  const { data: sessions = [], isLoading, isError } = useSessions(50)
  const del = useDeleteSession()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<WorkoutSession | null>(null)
  const [toEdit, setToEdit] = useState<WorkoutSession | null>(null)

  async function handleDelete() {
    if (!toDelete) return
    try {
      await del.mutateAsync(toDelete.id)
      toast.success('Seduta eliminata')
      if (expanded === toDelete.id) setExpanded(null)
      setToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore in eliminazione')
    }
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Non è stato possibile caricare lo storico delle sedute. Controlla la
        connessione e riprova.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nessuna seduta completata.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Appena chiudi il primo allenamento lo trovi qui con volume, serie e
          record.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const isOpen = expanded === s.id
        return (
          <div
            key={s.id}
            className="overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(s.started_at), "EEEE d MMMM yyyy 'alle' HH:mm", {
                      locale: it,
                    })}
                  </p>
                  {s.notes && (
                    <p className="truncate text-xs text-muted-foreground">{s.notes}</p>
                  )}
                </div>
                <div className="hidden shrink-0 gap-4 font-mono text-xs tabular text-muted-foreground sm:flex">
                  <span>{formatDuration(s.duration_sec)}</span>
                  <span>{formatVolume(Number(s.total_volume_kg))}</span>
                  <span>{s.total_sets} serie</span>
                  <span>{s.session_rpe != null ? `RPE ${s.session_rpe}` : 'RPE —'}</span>
                </div>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setToEdit(s)}
                aria-label={`Modifica seduta ${s.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setToDelete(s)}
                aria-label="Elimina seduta"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex gap-4 border-t border-border px-3 py-2 font-mono text-xs tabular text-muted-foreground sm:hidden">
              <span>{formatDuration(s.duration_sec)}</span>
              <span>{formatVolume(Number(s.total_volume_kg))}</span>
              <span>{s.total_sets} serie</span>
              <span>{s.session_rpe != null ? `RPE ${s.session_rpe}` : 'RPE —'}</span>
            </div>

            {isOpen && <SessionDetail sessionId={s.id} />}
          </div>
        )
      })}

      <EditSessionDialog session={toEdit} onClose={() => setToEdit(null)} />

      <Dialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare la seduta?</DialogTitle>
            <DialogDescription>
              «{toDelete?.name}» verrà rimossa dallo storico insieme a tutte le
              serie registrate. L'operazione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setToDelete(null)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              {del.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function EditSessionDialog({
  session,
  onClose,
}: {
  session: WorkoutSession | null
  onClose: () => void
}) {
  const update = useUpdateCompletedSession()
  const [start, setStart] = useState('')
  const [minutes, setMinutes] = useState('60')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!session) return
    setStart(toLocalInput(session.started_at))
    setMinutes(String(Math.max(1, Math.round((session.duration_sec ?? 60) / 60))))
    setNotes(session.notes ?? '')
  }, [session])

  const endValue = (() => {
    const startDate = new Date(start)
    const mins = Number(minutes)
    if (!start || Number.isNaN(startDate.getTime()) || !Number.isFinite(mins)) return ''
    return toLocalInput(new Date(startDate.getTime() + mins * 60_000).toISOString())
  })()

  function onEndChange(value: string) {
    const startDate = new Date(start)
    const endDate = new Date(value)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return
    const mins = Math.round((endDate.getTime() - startDate.getTime()) / 60_000)
    setMinutes(String(Math.max(1, mins)))
  }

  async function save() {
    if (!session) return
    const startDate = new Date(start)
    const mins = Number(minutes)
    if (Number.isNaN(startDate.getTime())) {
      toast.error('Data di inizio non valida')
      return
    }
    if (!Number.isFinite(mins) || mins < 1) {
      toast.error('La durata minima è 1 minuto')
      return
    }
    try {
      await update.mutateAsync({
        sessionId: session.id,
        startedAt: startDate.toISOString(),
        durationSec: Math.round(mins * 60),
        notes: notes.trim() || null,
      })
      toast.success('Seduta aggiornata')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Modifica non salvata')
    }
  }

  return (
    <Dialog
      open={!!session}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica seduta</DialogTitle>
          <DialogDescription>
            {session
              ? `«${session.name}». Correggi inizio, fine, durata e note. La durata vale anche per il bilancio in Home.`
              : 'Correggi la seduta già chiusa.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-start">Inizio</Label>
            <Input
              id="edit-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-end">Fine</Label>
            <Input
              id="edit-end"
              type="datetime-local"
              value={endValue}
              onChange={(e) => onEndChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-duration">Durata (minuti)</Label>
            <Input
              id="edit-duration"
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
            <Label htmlFor="edit-notes">Note</Label>
            <Textarea
              id="edit-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note sulla seduta"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button type="button" onClick={save} disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            Salva
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const { data, isLoading, isError } = useSession(sessionId)

  if (isError) {
    return (
      <p className="border-t border-border px-4 py-3 text-sm text-destructive">
        Non è stato possibile caricare il dettaglio di questa seduta.
      </p>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="flex justify-center border-t border-border py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (data.session_exercises.length === 0) {
    return (
      <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        Nessun esercizio registrato in questa seduta.
      </p>
    )
  }

  return (
    <div className="space-y-4 border-t border-border p-4">
      {data.notes && (
        <p className="text-sm italic text-muted-foreground">{data.notes}</p>
      )}
      {data.session_exercises.map((se) => (
        <div key={se.id}>
          <div className="flex flex-wrap items-baseline gap-2">
            <h5 className="text-sm font-medium">
              {se.exercise?.name ?? 'Esercizio'}
            </h5>
            {se.exercise && (
              <span className="text-[11px] text-muted-foreground">
                {muscleLabel(se.exercise.primary_muscle)}
              </span>
            )}
          </div>
          {se.notes && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {se.notes}
            </p>
          )}
          <ul className="mt-1.5 space-y-1">
            {se.session_sets.map((set, i) => (
              <li
                key={set.id}
                className="flex items-center gap-2 font-mono text-xs tabular"
              >
                <span className="w-5 shrink-0 text-muted-foreground">
                  {i + 1}
                </span>
                <span>
                  {set.weight_kg != null ? `${set.weight_kg} kg` : '—'}
                  {' × '}
                  {set.reps != null ? set.reps : '—'}
                </span>
                {set.rpe != null && (
                  <span className="text-muted-foreground">RPE {set.rpe}</span>
                )}
                {set.set_type !== 'normal' && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                    {SET_TYPE_LABELS[set.set_type]}
                  </span>
                )}
                {set.is_pr && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-primary">
                    <Trophy className="h-2.5 w-2.5" />
                    record
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
