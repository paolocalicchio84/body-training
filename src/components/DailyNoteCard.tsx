import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  useDailyNoteForDate,
  useUpsertDailyNote,
} from '@/features/diary/useDailyNotes'

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const ENERGY_LABELS = ['Molto bassa', 'Bassa', 'Ok', 'Buona', 'Ottima'] as const

type Props = {
  date: Date
  isToday: boolean
}

export function DailyNoteCard({ date, isToday }: Props) {
  const noteDate = toLocalDateStr(date)
  const { data: saved, isLoading } = useDailyNoteForDate(date)
  const upsert = useUpsertDailyNote()

  const [body, setBody] = useState('')
  const [energy, setEnergy] = useState<number | null>(null)

  useEffect(() => {
    setBody(saved?.body ?? '')
    setEnergy(saved?.energy ?? null)
  }, [saved?.id, saved?.body, saved?.energy, noteDate])

  const dirty =
    body.trim() !== (saved?.body ?? '').trim() ||
    energy !== (saved?.energy ?? null)

  async function handleSave() {
    try {
      await upsert.mutateAsync({
        note_date: noteDate,
        body,
        energy,
      })
      toast.success('Note del giorno salvate')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore salvataggio')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <NotebookPen className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Note del giorno</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Come ti senti{isToday ? ' oggi' : ' in questo giorno'}: testo libero
            e energia opzionale. L'AI le vede in chat.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-xs text-muted-foreground">Caricamento…</p>
      ) : (
        <div className="mt-4 space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Es. sonno mediocre, allenamento ok, voglia di dolci…"
            rows={3}
            className="resize-none text-sm"
            maxLength={2000}
          />

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Energia (1–5)
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  title={ENERGY_LABELS[n - 1]}
                  onClick={() => setEnergy(energy === n ? null : n)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-md border text-sm font-mono tabular transition-colors',
                    energy === n
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {n}
                </button>
              ))}
              {energy != null && (
                <span className="ml-1 self-center text-xs text-muted-foreground">
                  {ENERGY_LABELS[energy - 1]}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {body.trim().length > 0 || energy != null
                ? dirty
                  ? 'Modifiche non salvate'
                  : 'Salvato'
                : 'Vuoto'}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={upsert.isPending || !dirty}
            >
              {upsert.isPending ? 'Salvataggio…' : 'Salva'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
