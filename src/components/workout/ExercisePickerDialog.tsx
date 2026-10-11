import { useMemo, useState } from 'react'
import { Search, Plus, AlertTriangle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useExerciseSearch } from '@/features/workout/useExercises'
import { DemoBadge } from '@/components/workout/ExerciseDemo'
import { resolveExerciseDemoUrl } from '@/lib/exercise-media'
import {
  EQUIPMENT_LABELS,
  MUSCLE_ORDER,
  muscleLabel,
  type Exercise,
} from '@/features/workout/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chiamata con gli esercizi scelti alla conferma. */
  onSelect: (exercises: Exercise[]) => void
  /** Se true permette la selezione multipla con conferma finale. */
  multiple?: boolean
  title?: string
}

export function ExercisePickerDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = true,
  title = 'Aggiungi esercizio',
}: Props) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [picked, setPicked] = useState<Exercise[]>([])

  const filters = useMemo(() => ({ muscle, equipment }), [muscle, equipment])
  const { results, isLoading } = useExerciseSearch(query, filters)

  function reset() {
    setQuery('')
    setMuscle(null)
    setEquipment(null)
    setPicked([])
  }

  function handleRowClick(ex: Exercise) {
    if (!multiple) {
      onSelect([ex])
      onOpenChange(false)
      reset()
      return
    }
    setPicked((prev) =>
      prev.some((p) => p.id === ex.id)
        ? prev.filter((p) => p.id !== ex.id)
        : [...prev, ex],
    )
  }

  function confirm() {
    if (picked.length === 0) return
    onSelect(picked)
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      {/* Colonna flex con lista scrollabile e footer fisso: su mobile il
          pulsante di conferma deve restare sempre a portata di pollice. */}
      <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="shrink-0 space-y-3 p-4 pb-3 sm:p-6 sm:pb-3">
          <div className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Cerca per nome o filtra per gruppo muscolare e attrezzo.
            </DialogDescription>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="es. panca, squat, trazioni…"
              className="h-11 pl-9"
            />
          </div>

          <FilterRow
            label="Muscolo"
            options={MUSCLE_ORDER.map((m) => [m, muscleLabel(m)] as [string, string])}
            value={muscle}
            onChange={setMuscle}
          />
          <FilterRow
            label="Attrezzo"
            options={Object.entries(EQUIPMENT_LABELS)}
            value={equipment}
            onChange={setEquipment}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Caricamento…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nessun esercizio trovato. Prova con un altro nome o togli i
              filtri.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.slice(0, 80).map((ex) => {
                const isPicked = picked.some((p) => p.id === ex.id)
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(ex)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary',
                        isPicked && 'bg-primary/10',
                      )}
                    >
                      {multiple && (
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                            isPicked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border',
                          )}
                        >
                          {isPicked && <Check className="h-3.5 w-3.5" />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {ex.name}
                          </span>
                          <DemoBadge
                            hasDemo={Boolean(
                              resolveExerciseDemoUrl({
                                videoUrl: ex.video_url,
                                name: ex.name,
                                aliases: ex.aliases,
                              }),
                            )}
                          />
                          {ex.tier === 1 && (
                            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                              base
                            </span>
                          )}
                          {ex.discouraged && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label="Sconsigliato"
                            />
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {muscleLabel(ex.primary_muscle)}
                          {' · '}
                          {EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}
                          {ex.user_id && ' · personalizzato'}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {multiple ? (
          <div
            className="flex shrink-0 items-center justify-between gap-3 p-4 sm:p-6"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <span className="text-sm text-muted-foreground">
              {picked.length === 0
                ? 'Tocca per selezionare'
                : `${picked.length} selezionat${picked.length === 1 ? 'o' : 'i'}`}
            </span>
            <Button
              type="button"
              onClick={confirm}
              disabled={picked.length === 0}
              className="h-11 px-5"
            >
              <Plus className="h-4 w-4" />
              Aggiungi
              {picked.length > 0 && ` (${picked.length})`}
            </Button>
          </div>
        ) : (
          <div className="h-4 shrink-0" />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<[string, string]>
  value: string | null
  onChange: (v: string | null) => void
}) {
  // `min-w-0` sul contenitore: senza, la riga di chip impone la propria
  // larghezza al genitore invece di scorrere, e trascina fuori schermo
  // tutto il resto della dialog.
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="sticky left-0 z-10 shrink-0 bg-card pr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'shrink-0 rounded-full border border-border px-3 py-1.5 text-xs transition-colors',
          value === null
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:bg-secondary',
        )}
      >
        Tutti
      </button>
      {options.map(([key, lbl]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(value === key ? null : key)}
          className={cn(
            'shrink-0 rounded-full border border-border px-3 py-1.5 text-xs transition-colors',
            value === key
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary',
          )}
        >
          {lbl}
        </button>
      ))}
    </div>
  )
}
