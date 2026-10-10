import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  format,
  parseISO,
  isSameDay,
  addDays,
  subDays,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Utensils,
  Target,
  BarChart3,
  Scale,
  Sparkles,
  Dumbbell,
  Pill,
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/profile/useProfile'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import {
  sumMealTotals,
  useMealsForDate,
} from '@/features/meals/useMeals'
import { useReviewStatus } from '@/features/reviews/useReviews'
import { useWorkouts } from '@/features/training/useWorkouts'
import {
  useLogSupplement,
  useSupplementLogForDate,
  useSupplements,
  type Supplement,
} from '@/features/training/useSupplements'
import { Button } from '@/components/ui/Button'
import { QuickWeighDialog } from '@/components/QuickWeighDialog'
import { DailyNoteCard } from '@/components/DailyNoteCard'
import { cn } from '@/lib/utils'
import { round0 } from '@/lib/macro'
import { SectionHelp } from '@/components/tutorial/SectionHelp'

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function Home() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: measurements } = useMeasurements()

  // Data selezionata per la dashboard (default: oggi). Tutte le card sono
  // allineate a questa data. Banner e onboarding appaiono solo per oggi.
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const isToday = isSameDay(selectedDate, new Date())
  const dateInputRef = useRef<HTMLInputElement>(null)

  const { data: dayMeals = [] } = useMealsForDate(selectedDate)
  const totals = useMemo(() => sumMealTotals(dayMeals), [dayMeals])

  // Peso "as of" la data selezionata: prima misura con measured_at <= selectedDate.
  // measurements è ordinato desc per measured_at.
  const selectedDateStr = toLocalDateStr(selectedDate)
  const measurementAsOf = useMemo(() => {
    if (!measurements?.length) return null
    return measurements.find((m) => m.measured_at <= selectedDateStr) ?? null
  }, [measurements, selectedDateStr])
  // Misura precedente a quella as-of (per calcolare il delta)
  const measurementBeforeAsOf = useMemo(() => {
    if (!measurements?.length || !measurementAsOf) return null
    const idx = measurements.findIndex((m) => m.id === measurementAsOf.id)
    return measurements[idx + 1] ?? null
  }, [measurements, measurementAsOf])

  const latestGlobal = measurements?.[0] ?? null // la più recente in assoluto
  const weightDelta =
    measurementAsOf?.weight_kg != null &&
    measurementBeforeAsOf?.weight_kg != null
      ? Number(measurementAsOf.weight_kg) -
        Number(measurementBeforeAsOf.weight_kg)
      : null

  const hasGoal = profile?.goal_weight_kg != null
  const weightToGoal =
    hasGoal && measurementAsOf?.weight_kg != null
      ? Number(profile.goal_weight_kg) - Number(measurementAsOf.weight_kg)
      : null

  const hasTargets =
    profile?.target_kcal != null ||
    profile?.target_protein_g != null ||
    profile?.target_carb_g != null ||
    profile?.target_fat_g != null

  // Reminder "ripesati" basato sempre su oggi, non sulla data selezionata
  const daysSinceLastWeigh =
    latestGlobal?.measured_at != null
      ? Math.floor(
          (Date.now() - new Date(latestGlobal.measured_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null

  const reviewStatus = useReviewStatus()
  const [quickWeighOpen, setQuickWeighOpen] = useState(false)

  const { data: allRecentWorkouts = [] } = useWorkouts(60)
  const dayWorkouts = useMemo(() => {
    return allRecentWorkouts.filter(
      (w) => w.started_at.slice(0, 10) === selectedDateStr,
    )
  }, [allRecentWorkouts, selectedDateStr])
  const dayWorkoutStats = useMemo(() => {
    if (dayWorkouts.length === 0) return null
    return dayWorkouts.reduce(
      (acc, w) => ({
        count: acc.count + 1,
        duration: acc.duration + w.duration_min,
        kcal: acc.kcal + (w.kcal_burned ?? 0),
      }),
      { count: 0, duration: 0, kcal: 0 },
    )
  }, [dayWorkouts])

  const { data: supplementsList = [] } = useSupplements()
  const { data: supplementsForDay = [] } = useSupplementLogForDate(selectedDate)
  const logSupp = useLogSupplement()
  const activeSupps = supplementsList.filter((s) => s.active)
  const loggedIds = new Set(
    supplementsForDay.map((l) => l.supplement_id).filter(Boolean) as string[],
  )

  async function handleQuickLogSupp(s: Supplement) {
    try {
      // Se viewing past, imposta taken_at a mezzogiorno di quel giorno.
      let takenAt: string | undefined
      if (!isToday) {
        const d = new Date(selectedDate)
        d.setHours(12, 0, 0, 0)
        takenAt = d.toISOString()
      }
      await logSupp.mutateAsync({
        supplement_id: s.id,
        supplement_name: s.name,
        dose: s.dose,
        unit: s.unit,
        taken_at: takenAt,
      })
      toast.success(`${s.name} loggato`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  // Numero di pasti tracciati = quanti meal_types distinti con >= 1 entry
  const distinctMealTypesTracked = new Set(
    dayMeals.map((m) => m.meal_type),
  ).size

  const targets = {
    kcal: profile?.target_kcal ?? null,
    protein: profile?.target_protein_g ?? null,
    carb: profile?.target_carb_g ?? null,
    fat: profile?.target_fat_g ?? null,
  }

  const actuals = {
    kcal: totals.kcal,
    protein: totals.protein_g,
    carb: totals.carb_g,
    fat: totals.fat_g,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
            Dashboard
            <SectionHelp id="home" />
          </p>
          <button
            type="button"
            onClick={() => {
              const el = dateInputRef.current
              if (!el) return
              try {
                if (typeof el.showPicker === 'function') el.showPicker()
                else el.click()
              } catch {
                el.click()
              }
            }}
            className="mt-1 flex items-center gap-2 rounded-md text-left font-mono text-2xl font-semibold tracking-tight transition-colors hover:text-primary sm:text-3xl"
            title="Clicca per scegliere una data"
          >
            {isToday
              ? 'Oggi'
              : format(selectedDate, 'd MMMM yyyy', { locale: it })}
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDateStr}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              const [y, m, d] = v.split('-').map(Number)
              setSelectedDate(new Date(y, m - 1, d))
            }}
            className="sr-only"
            aria-label="Scegli data"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {format(selectedDate, 'EEEE', { locale: it })}
            {' · '}
            <span className="text-xs">{user?.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            aria-label="Giorno precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Oggi
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            aria-label="Giorno successivo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Review banner — priorità massima se presente, solo su today */}
      {isToday && reviewStatus.hasPendingAction && reviewStatus.latest && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20">
              <BarChart3 className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-warning">
                Revisione: l'AI suggerisce un aggiustamento
              </h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {reviewStatus.latest.ai_suggestion?.summary}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/reviews">Vedi</Link>
            </Button>
          </div>
        </div>
      )}

      {isToday &&
        !reviewStatus.hasPendingAction &&
        reviewStatus.dueForNewReview &&
        hasGoal &&
        hasTargets && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Revisione bisettimanale</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reviewStatus.latest
                    ? `Ultima revisione ${reviewStatus.daysSinceLatest} giorni fa. Genera la prossima.`
                    : 'Non hai mai generato una revisione. Dopo 14 giorni di tracking è il momento giusto.'}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/reviews">Apri</Link>
              </Button>
            </div>
          </div>
        )}

      {/* 4 macro cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MacroCard
          label="Kcal"
          unit=""
          actual={actuals.kcal}
          target={targets.kcal}
          accent
        />
        <MacroCard
          label="Proteine"
          unit="g"
          actual={actuals.protein}
          target={targets.protein}
        />
        <MacroCard
          label="Carboidrati"
          unit="g"
          actual={actuals.carb}
          target={targets.carb}
        />
        <MacroCard
          label="Grassi"
          unit="g"
          actual={actuals.fat}
          target={targets.fat}
        />
      </div>

      {/* Peso — as of data selezionata */}
      <WeightRow
        weight={
          measurementAsOf?.weight_kg != null
            ? Number(measurementAsOf.weight_kg)
            : null
        }
        delta={weightDelta}
        measuredAt={measurementAsOf?.measured_at ?? null}
        goal={
          profile?.goal_weight_kg != null
            ? Number(profile.goal_weight_kg)
            : null
        }
        toGoal={weightToGoal}
        onQuickWeigh={() => setQuickWeighOpen(true)}
      />

      {/* Onboarding + reminder: solo quando stai guardando OGGI.
          Se stai navigando un giorno passato, questi non si mostrano
          (staresti guardando uno stato storico). */}
      {isToday && (!profile?.height_cm || !profile?.sex) ? (
        <OnboardCard
          title="Completa l'assessment iniziale"
          description="Un flusso guidato in 5 passaggi per configurare profilo, obiettivo, misure e target."
          to="/assessment"
          cta="Avvia assessment"
          icon={Sparkles}
        />
      ) : isToday && !hasTargets ? (
        <OnboardCard
          title="Imposta i target giornalieri"
          description="Definisci kcal e macro (calcolati in un click) per vedere quanto ti manca ogni giorno."
          to="/settings"
          cta="Vai ai target"
          icon={Target}
        />
      ) : isToday && !latestGlobal ? (
        <OnboardCard
          title="Aggiungi la prima misura"
          description="Profilo ok. Inserisci peso (e body fat) per iniziare a tracciare l'andamento."
          to="/settings"
          cta="Aggiungi misura"
        />
      ) : isToday &&
        daysSinceLastWeigh != null &&
        daysSinceLastWeigh >= 7 ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">È ora di ripesarti</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Sono passati {daysSinceLastWeigh} giorni dall'ultima misurazione.
            I dati freschi rendono le review AI più accurate.
          </p>
          <Button
            type="button"
            className="mt-4"
            size="sm"
            onClick={() => setQuickWeighOpen(true)}
          >
            <Scale className="h-4 w-4" />
            Pesati ora
          </Button>
        </div>
      ) : isToday && dayMeals.length === 0 ? (
        <OnboardCard
          title="Logga il primo pasto di oggi"
          description="Scansiona un barcode, cerca un alimento o inserisci manualmente."
          to="/meals"
          cta="Vai ai pasti"
          icon={Utensils}
        />
      ) : dayMeals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Nessun pasto tracciato in questo giorno.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                {distinctMealTypesTracked}/4 pasti tracciati{isToday ? ' oggi' : ''}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {dayMeals.length}{' '}
                {dayMeals.length === 1 ? 'voce' : 'voci'} loggate · ultima:{' '}
                {format(parseISO(dayMeals[dayMeals.length - 1].eaten_at), 'HH:mm')}
                {' · '}
                {dayMeals[dayMeals.length - 1].food_name}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/meals">
                Dettagli
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Diario giornaliero — note + energia per la data selezionata */}
      <DailyNoteCard date={selectedDate} isToday={isToday} />

      {/* Card Training — sempre visibile se profilo completo */}
      {profile?.sex && profile?.height_cm && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Dumbbell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  Training{isToday ? ' oggi' : ''}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dayWorkoutStats
                    ? `${dayWorkoutStats.count} ${dayWorkoutStats.count === 1 ? 'sessione' : 'sessioni'} · ${dayWorkoutStats.duration} min${dayWorkoutStats.kcal > 0 ? ` · ~${round0(dayWorkoutStats.kcal)} kcal bruciate` : ''}`
                    : isToday
                      ? 'Nessuna sessione registrata'
                      : 'Nessuna sessione questo giorno'}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/training">
                {dayWorkoutStats ? 'Dettagli' : 'Logga'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Card Integratori — solo se ne hai nel catalogo */}
      {activeSupps.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Pill className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">
                Integratori{isToday ? ' oggi' : ''}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {loggedIds.size}/{activeSupps.length} presi · tocca per loggare
                {!isToday && ' in questo giorno'}
              </p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {activeSupps.slice(0, 6).map((s) => {
              const taken = loggedIds.has(s.id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={taken || logSupp.isPending}
                    onClick={() => handleQuickLogSupp(s)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                      taken
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-background hover:border-primary/40',
                    )}
                  >
                    {taken ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Pill className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {s.name}
                    </span>
                    {s.dose != null && (
                      <span className="shrink-0 font-mono text-[10px] tabular text-muted-foreground">
                        {s.dose}
                        {s.unit ?? ''}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          {activeSupps.length > 6 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              +{activeSupps.length - 6} altri in <Link to="/training" className="text-primary underline">Training</Link>
            </p>
          )}
        </div>
      )}

      <QuickWeighDialog
        open={quickWeighOpen}
        onOpenChange={setQuickWeighOpen}
      />
    </div>
  )
}

// ============================================================
// MACRO CARD
// ============================================================
function MacroCard({
  label,
  unit,
  actual,
  target,
  accent,
}: {
  label: string
  unit: string
  actual: number
  target: number | null
  accent?: boolean
}) {
  const hasTarget = target != null && target > 0
  const remaining = hasTarget ? target - actual : null
  const pct = hasTarget ? Math.min(100, Math.max(0, (actual / target!) * 100)) : 0
  const over = hasTarget && actual > target!
  const overAmount = over ? actual - target! : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="mt-2">
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'font-mono text-2xl font-semibold tabular',
              accent && 'text-primary',
            )}
          >
            {round0(actual)}
          </span>
          {hasTarget && (
            <span className="font-mono text-sm text-muted-foreground tabular">
              / {target}
              {unit && ` ${unit}`}
            </span>
          )}
          {!hasTarget && unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>

      {hasTarget && (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full transition-all',
                over ? 'bg-warning' : 'bg-primary',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={cn(
              'mt-1.5 font-mono text-[11px] tabular',
              over ? 'text-warning' : 'text-muted-foreground',
            )}
          >
            {over ? (
              <>
                +{round0(overAmount)}
                {unit} oltre target
              </>
            ) : (
              <>
                mancano {round0(remaining!)}
                {unit}
              </>
            )}
          </p>
        </>
      )}

      {!hasTarget && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nessun target impostato
        </p>
      )}
    </div>
  )
}

// ============================================================
// WEIGHT ROW
// ============================================================
function WeightRow({
  weight,
  delta,
  measuredAt,
  goal,
  toGoal,
  onQuickWeigh,
}: {
  weight: number | null
  delta: number | null
  measuredAt: string | null
  goal: number | null
  toGoal: number | null
  onQuickWeigh: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Peso attuale
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-semibold tabular">
              {weight != null ? weight : '—'}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kg
              </span>
            </p>
            {delta != null && <DeltaBadge value={delta} />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {measuredAt
              ? format(parseISO(measuredAt), 'd MMM yyyy', { locale: it })
              : 'Nessuna misura'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onQuickWeigh}
            >
              <Scale className="h-3.5 w-3.5" />
              Pesati ora
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/andamento">
                Andamento
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        {goal != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Target
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular">
              {goal}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kg
              </span>
            </p>
            {toGoal != null && (
              <p className="mt-1 font-mono text-xs tabular text-muted-foreground">
                {toGoal > 0 ? '+' : ''}
                {toGoal.toFixed(1)} kg da fare
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DeltaBadge({ value }: { value: number }) {
  const isZero = Math.abs(value) < 0.05
  const Icon = isZero ? Minus : value > 0 ? TrendingUp : TrendingDown
  const color = isZero
    ? 'text-muted-foreground'
    : value > 0
      ? 'text-warning'
      : 'text-primary'
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs tabular ${color}`}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}
    </span>
  )
}

function OnboardCard({
  title,
  description,
  to,
  cta,
  icon: Icon = ArrowRight,
}: {
  title: string
  description: string
  to: string
  cta: string
  icon?: typeof ArrowRight
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-4" size="sm">
        <Link to={to}>
          <Icon className="h-4 w-4" />
          {cta}
        </Link>
      </Button>
    </div>
  )
}
