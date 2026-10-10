import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Search,
  ScanLine,
  Pencil,
  ChefHat,
  ArrowLeft,
  Sparkles,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/utils'
import { guessMealType, MEAL_TYPE_LABELS, round0, round1 } from '@/lib/macro'
import { useAddMealEntry, type MealType } from '@/features/meals/useMeals'
import {
  useRecipes,
  recipePerServing,
  type Recipe,
} from '@/features/recipes/useRecipes'
import {
  FoodBarcodeTab,
  FoodManualTab,
  FoodSearchTab,
  MacroPreview,
  type PickedFood,
} from '@/components/food-picker/FoodPicker'
import {
  useParseMeal,
  type ParsedMealItem,
} from '@/features/ai/useParseMeal'

type Tab = 'ai' | 'search' | 'barcode' | 'manual' | 'recipe'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultMealType?: MealType
}

export function MealAddDialog({ open, onOpenChange, defaultMealType }: Props) {
  const [tab, setTab] = useState<Tab>('ai')
  const [mealType, setMealType] = useState<MealType>(
    defaultMealType ?? guessMealType(),
  )
  const [eatenAt, setEatenAt] = useState(toLocalInputValue(new Date()))

  useEffect(() => {
    if (open) {
      setTab('ai')
      setMealType(defaultMealType ?? guessMealType())
      setEatenAt(toLocalInputValue(new Date()))
    }
  }, [open, defaultMealType])

  const addMealEntry = useAddMealEntry()

  // Inserisce UNA voce senza chiudere il dialog (usato da commitMulti).
  async function insertOne(
    p: PickedFood,
    recipe_id?: string | null,
    servings?: number | null,
  ) {
    await addMealEntry.mutateAsync({
      eaten_at: new Date(eatenAt).toISOString(),
      meal_type: mealType,
      food_name: p.food_name,
      food_id: p.food_id,
      recipe_id: recipe_id ?? null,
      grams: recipe_id ? null : p.grams > 0 ? p.grams : null,
      servings: servings ?? null,
      kcal: round1(p.kcal),
      protein_g: round1(p.protein_g),
      carb_g: round1(p.carb_g),
      fat_g: round1(p.fat_g),
      source: recipe_id ? 'recipe' : p.source,
      raw_ai_text: p.raw_ai_text ?? null,
      confidence: p.confidence ?? null,
    })
  }

  async function commit(
    p: PickedFood,
    recipe_id?: string | null,
    servings?: number | null,
  ) {
    try {
      await insertOne(p, recipe_id, servings)
      toast.success(`Aggiunto: ${p.food_name}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function commitMulti(items: PickedFood[]) {
    if (items.length === 0) return
    try {
      for (const p of items) {
        await insertOne(p)
      }
      toast.success(
        items.length === 1
          ? `Aggiunto: ${items[0].food_name}`
          : `${items.length} voci aggiunte`,
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore durante inserimento')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aggiungi pasto</DialogTitle>
          <DialogDescription>
            Descrivi a voce all'AI, cerca, scansiona o inserisci manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-2 block">Tipo di pasto</Label>
            <div className="grid grid-cols-4 gap-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMealType(t)}
                  className={cn(
                    'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                    mealType === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {MEAL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eaten_at">Quando</Label>
            <Input
              id="eaten_at"
              type="datetime-local"
              value={eatenAt}
              onChange={(e) => setEatenAt(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-5 gap-1 rounded-md border border-border bg-background p-1">
          <TabButton icon={Sparkles} label="AI" active={tab === 'ai'} onClick={() => setTab('ai')} accent />
          <TabButton icon={Search} label="Cerca" active={tab === 'search'} onClick={() => setTab('search')} />
          <TabButton icon={ScanLine} label="Codice a barre" active={tab === 'barcode'} onClick={() => setTab('barcode')} />
          <TabButton icon={Pencil} label="Rapido" active={tab === 'manual'} onClick={() => setTab('manual')} />
          <TabButton icon={ChefHat} label="Ricetta" active={tab === 'recipe'} onClick={() => setTab('recipe')} />
        </div>

        <div className="min-h-[200px]">
          {tab === 'ai' && (
            <AiMealTab mealType={mealType} onCommit={commitMulti} />
          )}
          {tab === 'search' && <FoodSearchTab onPicked={(p) => commit(p)} />}
          {tab === 'barcode' && <FoodBarcodeTab onPicked={(p) => commit(p)} />}
          {tab === 'manual' && <FoodManualTab onPicked={(p) => commit(p)} />}
          {tab === 'recipe' && <RecipePickerTab onPick={commit} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
  accent,
}: {
  icon: typeof Search
  label: string
  active: boolean
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-sm py-2 text-xs transition-colors',
        active
          ? accent
            ? 'bg-primary/15 text-primary'
            : 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// ============================================================
// AI MEAL TAB
// ============================================================
function AiMealTab({
  mealType,
  onCommit,
}: {
  mealType: MealType
  onCommit: (items: PickedFood[]) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<ParsedMealItem[] | null>(null)
  const [meta, setMeta] = useState<{
    model: string
    cost_cents: number
    budget_remaining_cents: number
    tokens_in: number
    tokens_out: number
  } | null>(null)
  const [errorBox, setErrorBox] = useState<string | null>(null)
  const parse = useParseMeal()

  async function handleAnalyze() {
    if (!text.trim()) {
      toast.error('Descrivi cosa hai mangiato')
      return
    }
    setErrorBox(null)
    try {
      const res = await parse.mutateAsync({ meal_text: text, meal_type: mealType })
      setItems(res.items)
      setMeta({
        model: res.model,
        cost_cents: res.cost_cents,
        budget_remaining_cents: res.budget_remaining_cents,
        tokens_in: res.tokens_in,
        tokens_out: res.tokens_out,
      })
      if (res.items.length === 0) {
        setErrorBox(
          "L'AI non è riuscita a identificare alimenti nella tua descrizione. Prova a essere più specifico (es. \"150g riso basmati, 200g petto di pollo, 10g olio\").",
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore'
      setErrorBox(msg)
    }
  }

  async function handleCommit() {
    if (!items?.length) return
    const payload: PickedFood[] = items.map((it) => ({
      food_id: it.matched_food_id,
      food_name: it.name,
      grams: it.grams,
      kcal: it.kcal,
      protein_g: it.protein_g,
      carb_g: it.carb_g,
      fat_g: it.fat_g,
      source: 'ai_chat',
      raw_ai_text: text,
      confidence: it.confidence,
    }))
    await onCommit(payload)
  }

  function updateItem(idx: number, patch: Partial<ParsedMealItem>) {
    setItems((cur) =>
      cur ? cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)) : cur,
    )
  }

  function removeItem(idx: number) {
    setItems((cur) => (cur ? cur.filter((_, i) => i !== idx) : cur))
  }

  function resetForNew() {
    setText('')
    setItems(null)
    setMeta(null)
    setErrorBox(null)
  }

  const total = items
    ? items.reduce(
        (acc, it) => ({
          kcal: acc.kcal + it.kcal,
          protein: acc.protein + it.protein_g,
          carb: acc.carb + it.carb_g,
          fat: acc.fat + it.fat_g,
        }),
        { kcal: 0, protein: 0, carb: 0, fat: 0 },
      )
    : null

  if (items && items.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={resetForNew}>
            <ArrowLeft className="h-4 w-4" />
            Modifica descrizione
          </Button>
          <div className="flex-1" />
          {meta && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {meta.model} · {meta.tokens_in + meta.tokens_out} tok ·{' '}
              {meta.cost_cents < 1
                ? '<1¢'
                : `${(meta.cost_cents / 100).toFixed(2)}¢`}
            </span>
          )}
        </div>

        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="rounded-md border border-border bg-background/50 p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <Input
                  value={it.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  aria-label="Rimuovi"
                  className="h-9 w-9 shrink-0"
                >
                  <span className="text-muted-foreground">×</span>
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-2 font-mono text-xs tabular">
                <MiniNumField
                  label="g"
                  value={it.grams}
                  onChange={(n) => rescaleItem(updateItem, idx, it, 'grams', n)}
                />
                <MiniNumField
                  label="Kcal"
                  value={it.kcal}
                  onChange={(n) => updateItem(idx, { kcal: n })}
                />
                <MiniNumField
                  label="P"
                  value={it.protein_g}
                  onChange={(n) => updateItem(idx, { protein_g: n })}
                />
                <MiniNumField
                  label="C"
                  value={it.carb_g}
                  onChange={(n) => updateItem(idx, { carb_g: n })}
                />
                <MiniNumField
                  label="G"
                  value={it.fat_g}
                  onChange={(n) => updateItem(idx, { fat_g: n })}
                />
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>confidence</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full',
                      it.confidence >= 0.7 ? 'bg-primary' : 'bg-warning',
                    )}
                    style={{ width: `${Math.round(it.confidence * 100)}%` }}
                  />
                </div>
                <span className="font-mono tabular">{(it.confidence * 100).toFixed(0)}%</span>
                {it.matched_food_id && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 text-[9px] text-primary">
                    match locale
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>

        {total && (
          <MacroPreview
            kcal={total.kcal}
            protein={total.protein}
            carb={total.carb}
            fat={total.fat}
          />
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="flex-1"
            onClick={handleCommit}
            disabled={items.length === 0}
          >
            Aggiungi {items.length === 1 ? 'voce' : `${items.length} voci`}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="ai_meal_text">Descrivi cosa hai mangiato</Label>
        <Textarea
          id="ai_meal_text"
          rows={4}
          placeholder="es. 150g riso basmati, petto di pollo alla griglia 200g, 1 cucchiaio di olio, insalata mista"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={parse.isPending}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Sii specifico con grammature quando puoi. L'AI stimerà gli altri valori.
        </p>
      </div>

      {errorBox && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
          {errorBox}
        </div>
      )}

      <Button
        type="button"
        onClick={handleAnalyze}
        disabled={parse.isPending || !text.trim()}
        className="w-full"
      >
        {parse.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisi in corso…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Analizza con AI
          </>
        )}
      </Button>
    </div>
  )
}

// Rescale kcal/macro when grams change for a matched local food.
// Se non c'è matched_food_id, scala proporzionalmente.
function rescaleItem(
  update: (idx: number, patch: Partial<ParsedMealItem>) => void,
  idx: number,
  current: ParsedMealItem,
  _key: 'grams',
  newGrams: number,
) {
  if (newGrams <= 0 || current.grams <= 0) {
    update(idx, { grams: newGrams })
    return
  }
  const factor = newGrams / current.grams
  update(idx, {
    grams: newGrams,
    kcal: round1(current.kcal * factor),
    protein_g: round1(current.protein_g * factor),
    carb_g: round1(current.carb_g * factor),
    fat_g: round1(current.fat_g * factor),
  })
}

function MiniNumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="text-center text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <Input
        type="number"
        step="0.1"
        min="0"
        value={Number.isFinite(value) ? round1(value) : 0}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="h-8 px-2 text-center font-mono text-xs"
      />
    </div>
  )
}

// ============================================================
// RECIPE PICKER TAB
// ============================================================
function RecipePickerTab({
  onPick,
}: {
  onPick: (
    p: PickedFood,
    recipe_id?: string | null,
    servings?: number | null,
  ) => Promise<void>
}) {
  const { data: recipes = [] } = useRecipes()
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState('1')

  if (recipes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Non hai ancora ricette. Creane una in{' '}
        <span className="font-semibold">Ricette</span>.
      </p>
    )
  }

  if (selected) {
    const per = recipePerServing(selected)
    const s = Math.max(0.1, num(servings) || 1)
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </Button>
          <div className="flex-1 text-sm font-semibold">{selected.name}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="r_servings">Porzioni</Label>
          <Input
            id="r_servings"
            type="number"
            step="0.1"
            min="0.1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="font-mono"
          />
        </div>

        <MacroPreview
          kcal={per.kcal * s}
          protein={per.protein * s}
          carb={per.carb * s}
          fat={per.fat * s}
        />

        <Button
          type="button"
          className="w-full"
          onClick={() =>
            onPick(
              {
                food_id: null,
                food_name: selected.name,
                grams: 0,
                kcal: per.kcal * s,
                protein_g: per.protein * s,
                carb_g: per.carb * s,
                fat_g: per.fat * s,
                source: 'manual',
              },
              selected.id,
              s,
            )
          }
        >
          Aggiungi al pasto
        </Button>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {recipes.map((r) => {
        const per = recipePerServing(r)
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-secondary"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.servings} porzioni · {(r.recipe_items ?? []).length} ingredienti
                </div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs tabular text-muted-foreground">
                <div>{round0(per.kcal)} kcal/porz</div>
                <div>{round0(per.protein)}g P</div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
