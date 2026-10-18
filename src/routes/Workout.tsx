import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BarChart3,
  Dumbbell,
  History,
  Loader2,
  Play,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useActiveSession, useStartSession } from '@/features/workout/useSessions'
import { useWorkoutClock } from '@/features/workout/WorkoutClock'
import { useTrainingSummary } from '@/features/workout/useWorkoutStats'
import { formatDuration, formatVolume } from '@/features/workout/types'
import { RoutinesTab } from './workout/RoutinesTab'
import { HistoryTab } from './workout/HistoryTab'
import { StatsTab } from './workout/StatsTab'
import { CoachTab } from './workout/CoachTab'
import { SectionHelp } from '@/components/tutorial/SectionHelp'

type TabKey = 'routines' | 'history' | 'stats' | 'coach'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Dumbbell }> = [
  { key: 'routines', label: 'Schede', icon: Dumbbell },
  { key: 'history', label: 'Storico', icon: History },
  { key: 'stats', label: 'Statistiche', icon: BarChart3 },
  { key: 'coach', label: 'Coach AI', icon: Sparkles },
]

export function Workout() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabKey>('routines')

  const { data: summary, isError: summaryError } = useTrainingSummary(4)
  const { data: active } = useActiveSession()
  const { elapsedSec } = useWorkoutClock()
  const start = useStartSession()

  async function handleStartFree() {
    try {
      await start.mutateAsync({})
      navigate('/allenamento/sessione')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Impossibile avviare la sessione',
      )
    }
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
            Allenamento
            <SectionHelp id="workout" />
          </p>
          <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            Schede, log e coach
          </h2>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Costruisci le schede, registra le sedute e tieni sotto controllo il
            volume per gruppo muscolare.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 w-full sm:w-auto"
          onClick={handleStartFree}
          disabled={start.isPending || !!active}
          title={
            active
              ? 'Hai già un allenamento in corso: riprendilo o chiudilo prima di iniziarne un altro.'
              : undefined
          }
        >
          {start.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Avvio…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Inizia allenamento libero
            </>
          )}
        </Button>
      </div>

      {active && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary">
                Allenamento in corso
              </p>
              <p className="mt-1 font-mono text-lg font-semibold">
                {active.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tempo contato {formatDuration(elapsedSec)} ·{' '}
                {active.session_exercises.length} esercizi
              </p>
            </div>
            <Button
              type="button"
              className="h-11"
              onClick={() => navigate('/allenamento/sessione')}
            >
              <Play className="h-4 w-4" />
              Riprendi
            </Button>
          </div>
        </div>
      )}

      {summaryError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Non è stato possibile caricare il riepilogo delle ultime 4 settimane.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <SummaryTile
            label="Sedute / settimana"
            value={summary ? summary.sessionsPerWeek.toFixed(1) : '—'}
            hint={summary ? `${summary.sessions} nelle ultime 4 settimane` : ''}
            primary
          />
          <SummaryTile
            label="Volume totale"
            value={summary ? formatVolume(summary.totalVolumeKg) : '—'}
          />
          <SummaryTile
            label="Minuti"
            value={summary ? String(summary.totalMinutes) : '—'}
            unit="min"
          />
          <SummaryTile
            label="Serie"
            value={summary ? String(summary.totalSets) : '—'}
          />
        </div>
      )}

      {/* Sticky sotto la Topbar (h-14): su mobile la testata è alta e senza
          questo bisognerebbe risalire tutta la pagina per cambiare sezione.
          Riga a scorrimento orizzontale invece di wrap su due righe. */}
      <div className="sticky top-14 z-10 flex gap-2 overflow-x-auto border-b border-border bg-background pb-3 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
              tab === key
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'routines' && <RoutinesTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'stats' && <StatsTab />}
      {tab === 'coach' && <CoachTab />}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  unit,
  hint,
  primary,
}: {
  label: string
  value: string
  unit?: string
  hint?: string
  primary?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-xl font-semibold tabular',
          primary && 'text-primary',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
