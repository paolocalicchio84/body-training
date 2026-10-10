import { useMemo, useRef, useState } from 'react'
import { format, isSameDay, parseISO, addDays, subDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Move,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MealAddDialog } from './meals/MealAddDialog'
import { MealEditDialog } from './meals/MealEditDialog'
import {
  sumMealTotals,
  useDeleteMealEntry,
  useMealsForDate,
  type MealEntry,
  type MealType,
} from '@/features/meals/useMeals'
import { useProfile } from '@/features/profile/useProfile'
import { MEAL_TYPE_LABELS, round0, round1 } from '@/lib/macro'
import { SectionHelp } from '@/components/tutorial/SectionHelp'
import { GeminiSetupBanner } from '@/components/ai/GeminiSetupBanner'

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function Meals() {
  const [date, setDate] = useState(() => new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [defaultMealType, setDefaultMealType] = useState<MealType | undefined>()
  const [editing, setEditing] = useState<MealEntry | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const { data: entries = [], isLoading } = useMealsForDate(date)
  const { data: profile } = useProfile()
  const totals = useMemo(() => sumMealTotals(entries), [entries])
  const deleteEntry = useDeleteMealEntry()

  const groupsOrder: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const groups = useMemo(() => {
    const map: Record<MealType, MealEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    for (const e of entries) {
      map[e.meal_type].push(e)
    }
    return map
  }, [entries])

  const proteinTarget = profile?.goal_weight_kg
    ? round0(Number(profile.goal_weight_kg) * 1.8)
    : null

  const isToday = isSameDay(date, new Date())

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo pasto?')) return
    try {
      await deleteEntry.mutateAsync(id)
      toast.success('Pasto eliminato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  function openAdd(mealType?: MealType) {
    setDefaultMealType(mealType)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <GeminiSetupBanner />

      {/* Header con navigazione data */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
            Pasti
            <SectionHelp id="meals" />
          </p>
          <button
            type="button"
            onClick={() => {
              const el = dateInputRef.current
              if (!el) return
              // showPicker è moderno (Chrome/Safari recenti). Fallback: focus.
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
            {isToday ? 'Oggi' : format(date, 'd MMMM yyyy', { locale: it })}
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={toLocalDateStr(date)}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              const [y, m, d] = v.split('-').map(Number)
              setDate(new Date(y, m - 1, d))
            }}
            className="sr-only"
            aria-label="Scegli data"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {format(date, 'EEEE', { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setDate((d) => subDays(d, 1))}
            aria-label="Giorno precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDate(new Date())}
            >
              Oggi
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setDate((d) => addDays(d, 1))}
            aria-label="Giorno successivo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Totali */}
      <div className="grid grid-cols-4 gap-3 rounded-lg border border-border bg-card p-4">
        <TotalTile label="Kcal" value={round0(totals.kcal)} primary />
        <TotalTile
          label="Proteine"
          value={`${round0(totals.protein_g)}g`}
          hint={proteinTarget ? `/ ${proteinTarget}g` : undefined}
        />
        <TotalTile label="Carbo" value={`${round0(totals.carb_g)}g`} />
        <TotalTile label="Grassi" value={`${round0(totals.fat_g)}g`} />
      </div>

      {/* Gruppi */}
      <div className="space-y-4">
        {groupsOrder.map((mt) => (
          <MealGroup
            key={mt}
            mealType={mt}
            entries={groups[mt]}
            onAdd={() => openAdd(mt)}
            onDelete={handleDelete}
            onMove={(entry) => setEditing(entry)}
          />
        ))}
      </div>

      {entries.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nessun pasto registrato per questa giornata.
          </p>
          <Button type="button" className="mt-4" onClick={() => openAdd()}>
            <Plus className="h-4 w-4" />
            Aggiungi il primo
          </Button>
        </div>
      )}

      {/* FAB aggiungi (sempre visibile) */}
      <Button
        type="button"
        onClick={() => openAdd()}
        // Il FAB sta sopra la BottomNav, che a sua volta rispetta la safe
        // area: senza questo su iPhone finisce sopra l'home indicator.
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        className="fixed right-4 z-20 h-14 w-14 rounded-full shadow-lg md:!bottom-6 md:right-6"
        size="icon"
        aria-label="Aggiungi pasto"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <MealAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultMealType={defaultMealType}
      />

      <MealEditDialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        entry={editing}
      />
    </div>
  )
}

function MealGroup({
  mealType,
  entries,
  onAdd,
  onDelete,
  onMove,
}: {
  mealType: MealType
  entries: MealEntry[]
  onAdd: () => void
  onDelete: (id: string) => void
  onMove: (entry: MealEntry) => void
}) {
  const subtotal = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + Number(e.kcal),
      protein: acc.protein + Number(e.protein_g),
    }),
    { kcal: 0, protein: 0 },
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{MEAL_TYPE_LABELS[mealType]}</h3>
        <div className="flex items-center gap-3 text-xs">
          {entries.length > 0 && (
            <span className="font-mono tabular text-muted-foreground">
              {round0(subtotal.kcal)} kcal · {round0(subtotal.protein)}g P
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAdd}
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi
          </Button>
        </div>
      </div>
      {entries.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.food_name}</div>
                <div className="font-mono text-xs tabular text-muted-foreground">
                  {e.grams != null && `${round0(Number(e.grams))}g · `}
                  {e.servings != null && `${round1(Number(e.servings))} porz · `}
                  {round0(Number(e.kcal))} kcal · {round0(Number(e.protein_g))}g P ·{' '}
                  {round0(Number(e.carb_g))}g C · {round0(Number(e.fat_g))}g G
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {format(parseISO(e.eaten_at), 'HH:mm')} · {e.source}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onMove(e)}
                aria-label="Sposta pasto"
                title="Sposta in un altro giorno o tipo pasto"
              >
                <Move className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDelete(e.id)}
                aria-label="Elimina"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Niente qui ancora.
        </div>
      )}
    </div>
  )
}

function TotalTile({
  label,
  value,
  hint,
  primary,
}: {
  label: string
  value: string | number
  hint?: string
  primary?: boolean
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={
          'mt-1 font-mono text-xl font-semibold tabular ' +
          (primary ? 'text-primary' : 'text-foreground')
        }
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
