import { useState, type FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile'
import { useAddMeasurement } from '@/features/measurements/useMeasurements'
import { round0 } from '@/lib/macro'

type Step = 0 | 1 | 2 | 3 | 4 | 5
const STEPS = [
  'Benvenuto',
  'Dati profilo',
  'Obiettivo',
  'Prima misura',
  'Target',
  'Fatto',
] as const

export function Assessment() {
  const [step, setStep] = useState<Step>(0)
  const navigate = useNavigate()

  function next() {
    setStep((s) => Math.min(5, s + 1) as Step)
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1) as Step)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-16">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Assessment iniziale</span>
          <span>
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 && <WelcomeStep onNext={next} onSkip={() => navigate('/')} />}
      {step === 1 && <ProfileStep onNext={next} onBack={prev} />}
      {step === 2 && <GoalStep onNext={next} onBack={prev} />}
      {step === 3 && <MeasurementStep onNext={next} onBack={prev} />}
      {step === 4 && <TargetsStep onNext={next} onBack={prev} />}
      {step === 5 && <DoneStep onGoHome={() => navigate('/')} onBack={prev} />}
    </div>
  )
}

// ============================================================
// 0. Welcome
// ============================================================
function WelcomeStep({
  onNext,
  onSkip,
}: {
  onNext: () => void
  onSkip: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h2 className="font-mono text-2xl font-semibold tracking-tight">
          Assessment iniziale
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          5 passaggi rapidi per configurare il tuo piano. Puoi modificare
          tutto in Impostazioni in qualsiasi momento.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>• Dati profilo (sesso, altezza, età)</li>
        <li>• Obiettivo (cut / bulk / recomp / maintain)</li>
        <li>• Prima misura (peso, body fat opzionale)</li>
        <li>• Target kcal e macro (calcolati o personalizzati)</li>
        <li>• Pronto a tracciare pasti, sonno, training</li>
      </ul>
      <div className="flex items-center gap-2 pt-2">
        <Button type="button" onClick={onNext}>
          Inizia
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip}>
          Salta, configuro a mano
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// 1. Profilo
// ============================================================
function ProfileStep({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  const [sex, setSex] = useState<'male' | 'female' | 'other' | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [height, setHeight] = useState('')
  const [activity, setActivity] = useState<
    'sedentary' | 'light' | 'moderate' | 'high' | 'athlete'
  >('moderate')

  useEffect(() => {
    if (profile) {
      if (profile.sex) setSex(profile.sex)
      if (profile.birth_date) setBirthDate(profile.birth_date)
      if (profile.height_cm) setHeight(String(profile.height_cm))
      if (profile.activity_level) setActivity(profile.activity_level)
    }
  }, [profile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sex) return toast.error('Seleziona il sesso')
    if (!birthDate) return toast.error('Inserisci la data di nascita')
    const h = Number(height)
    if (!Number.isFinite(h) || h < 100 || h > 250) {
      return toast.error('Altezza tra 100 e 250 cm')
    }
    try {
      await update.mutateAsync({
        sex,
        birth_date: birthDate,
        height_cm: h,
        activity_level: activity,
      })
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-mono text-xl font-semibold">Dati profilo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Servono per calcolare BMR e TDEE.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="aw_sex">Sesso</Label>
          <Select value={sex || undefined} onValueChange={(v) => setSex(v as typeof sex)}>
            <SelectTrigger id="aw_sex">
              <SelectValue placeholder="Seleziona…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Uomo</SelectItem>
              <SelectItem value="female">Donna</SelectItem>
              <SelectItem value="other">Altro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_birth">Data di nascita</Label>
          <Input
            id="aw_birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_height">Altezza (cm)</Label>
          <Input
            id="aw_height"
            type="number"
            step="0.1"
            min="100"
            max="250"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="177"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_activity">Livello attività</Label>
          <Select
            value={activity}
            onValueChange={(v) => setActivity(v as typeof activity)}
          >
            <SelectTrigger id="aw_activity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentary">Sedentario</SelectItem>
              <SelectItem value="light">Leggero</SelectItem>
              <SelectItem value="moderate">Moderato</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="athlete">Atleta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <StepNav
        canBack
        onBack={onBack}
        submitting={update.isPending}
        nextLabel="Avanti"
      />
    </form>
  )
}

// ============================================================
// 2. Obiettivo
// ============================================================
function GoalStep({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  const [goalType, setGoalType] = useState<
    'cut' | 'bulk' | 'recomp' | 'maintain' | ''
  >('')
  const [goalWeight, setGoalWeight] = useState('')
  const [goalBf, setGoalBf] = useState('')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    if (profile) {
      if (profile.goal_type) setGoalType(profile.goal_type)
      if (profile.goal_weight_kg) setGoalWeight(String(profile.goal_weight_kg))
      if (profile.goal_body_fat_pct)
        setGoalBf(String(profile.goal_body_fat_pct))
      if (profile.goal_deadline) setDeadline(profile.goal_deadline)
    }
  }, [profile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!goalType) return toast.error("Seleziona il tipo d'obiettivo")
    try {
      await update.mutateAsync({
        goal_type: goalType,
        goal_weight_kg: goalWeight ? Number(goalWeight) : null,
        goal_body_fat_pct: goalBf ? Number(goalBf) : null,
        goal_deadline: deadline || null,
      })
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-mono text-xl font-semibold">Obiettivo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fase attiva e target quantitativi.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tipo di fase</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { k: 'cut', l: 'Definizione', d: 'deficit kcal, perdi grasso' },
              { k: 'bulk', l: 'Massa', d: 'surplus kcal, metti muscolo' },
              { k: 'recomp', l: 'Ricomposizione', d: 'kcal stabili' },
              { k: 'maintain', l: 'Mantenimento', d: 'kcal a TDEE' },
            ] as const
          ).map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setGoalType(x.k)}
              className={cn(
                'rounded-md border p-3 text-left text-sm transition-colors',
                goalType === x.k
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="font-semibold">{x.l}</div>
              <div className="text-xs text-muted-foreground">{x.d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="aw_gw">Peso target (kg, opz.)</Label>
          <Input
            id="aw_gw"
            type="number"
            step="0.1"
            min="30"
            max="300"
            value={goalWeight}
            onChange={(e) => setGoalWeight(e.target.value)}
            className="font-mono"
            placeholder="80"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_gbf">Body fat target (%, opz.)</Label>
          <Input
            id="aw_gbf"
            type="number"
            step="0.1"
            min="3"
            max="60"
            value={goalBf}
            onChange={(e) => setGoalBf(e.target.value)}
            className="font-mono"
            placeholder="12"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="aw_dead">Scadenza (opz.)</Label>
          <Input
            id="aw_dead"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      <StepNav canBack onBack={onBack} submitting={update.isPending} />
    </form>
  )
}

// ============================================================
// 3. Misura
// ============================================================
function MeasurementStep({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const add = useAddMeasurement()
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [skip, setSkip] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (skip) {
      onNext()
      return
    }
    const w = Number(weight)
    if (!Number.isFinite(w) || w < 20 || w > 400) {
      return toast.error('Peso tra 20 e 400 kg')
    }
    try {
      await add.mutateAsync({
        measured_at: new Date().toISOString().slice(0, 10),
        weight_kg: w,
        body_fat_pct: bodyFat ? Number(bodyFat) : null,
      })
      toast.success('Prima misura registrata')
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-mono text-xl font-semibold">Prima misura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Serve come baseline per il calcolo dei target e i futuri confronti.
          Puoi saltare e farla dopo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="aw_w">Peso attuale (kg)</Label>
          <Input
            id="aw_w"
            type="number"
            step="0.1"
            min="20"
            max="400"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="font-mono"
            placeholder="75.5"
            disabled={skip}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_bf">Body fat (%, opz.)</Label>
          <Input
            id="aw_bf"
            type="number"
            step="0.1"
            min="3"
            max="60"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            className="font-mono"
            placeholder="16"
            disabled={skip}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={skip}
          onChange={(e) => setSkip(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-background accent-primary"
        />
        Salta, la aggiungo dopo
      </label>

      <StepNav canBack onBack={onBack} submitting={add.isPending} />
    </form>
  )
}

// ============================================================
// 4. Target
// ============================================================
function TargetsStep({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()

  // Suggerisci target via Mifflin-St Jeor + aggiustamento per goal
  const suggested = profile ? computeSuggested(profile) : null

  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carb, setCarb] = useState('')
  const [fat, setFat] = useState('')

  useEffect(() => {
    if (suggested && !kcal) {
      setKcal(String(suggested.kcal))
      setProtein(String(suggested.protein))
      setCarb(String(suggested.carb))
      setFat(String(suggested.fat))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        target_kcal: kcal ? Math.round(Number(kcal)) : null,
        target_protein_g: protein ? Math.round(Number(protein)) : null,
        target_carb_g: carb ? Math.round(Number(carb)) : null,
        target_fat_g: fat ? Math.round(Number(fat)) : null,
      })
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-mono text-xl font-semibold">Target giornalieri</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {suggested
            ? 'Calcolati da BMR × attività aggiustato per la tua fase. Modificali se preferisci.'
            : 'Inseriscili a mano o torna indietro per completare il profilo.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="aw_k">Kcal/giorno</Label>
          <Input
            id="aw_k"
            type="number"
            min="0"
            step="1"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_p">Prot (g)</Label>
          <Input
            id="aw_p"
            type="number"
            min="0"
            step="1"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_c">Carb (g)</Label>
          <Input
            id="aw_c"
            type="number"
            min="0"
            step="1"
            value={carb}
            onChange={(e) => setCarb(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aw_f">Grassi (g)</Label>
          <Input
            id="aw_f"
            type="number"
            min="0"
            step="1"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      <StepNav canBack onBack={onBack} submitting={update.isPending} />
    </form>
  )
}

// ============================================================
// 5. Done
// ============================================================
function DoneStep({
  onGoHome,
  onBack,
}: {
  onGoHome: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h2 className="font-mono text-2xl font-semibold">Pronto.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Il tuo profilo e i target sono impostati. Da qui in avanti:
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        <li>
          <strong>Gemini</strong> — Impostazioni → AI → key Gemini → Testa →
          modello flash → Provider attivo = Gemini. Senza questo Chat e parse
          pasti non funzionano.
        </li>
        <li>
          <strong>Pasti</strong> — logga oggi con l'AI o in manuale.
        </li>
        <li>
          <strong>Allenamento</strong> — crea almeno una scheda così la chat
          può valutarla senza inventare esercizi.
        </li>
        <li>
          <strong>Revisione</strong> — dopo 14 giorni di dati, genera una
          revisione bisettimanale per tarare i target.
        </li>
      </ul>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button asChild>
          <Link to="/settings#ai-settings">
            Configura Gemini
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button type="button" variant="outline" onClick={onGoHome}>
          Vai alla home
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================
function StepNav({
  canBack,
  onBack,
  submitting,
  nextLabel = 'Avanti',
}: {
  canBack?: boolean
  onBack?: () => void
  submitting?: boolean
  nextLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Salvataggio…' : nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {canBack && onBack && (
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </Button>
      )}
    </div>
  )
}

function computeSuggested(profile: {
  sex: string | null
  birth_date: string | null
  height_cm: number | null
  activity_level: string | null
  goal_type: string | null
  goal_weight_kg: number | null
}) {
  if (!profile.sex || !profile.birth_date || !profile.height_cm) return null
  const age =
    new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
  // Peso ref per BMR: se c'è goal_weight, usalo come proxy
  const weightRef = profile.goal_weight_kg ?? 75

  const bmr =
    profile.sex === 'male'
      ? 10 * weightRef + 6.25 * profile.height_cm - 5 * age + 5
      : profile.sex === 'female'
        ? 10 * weightRef + 6.25 * profile.height_cm - 5 * age - 161
        : 10 * weightRef + 6.25 * profile.height_cm - 5 * age - 78

  const mul: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    athlete: 1.9,
  }
  const tdee = bmr * (mul[profile.activity_level ?? 'moderate'] ?? 1.55)

  const adj: Record<string, number> = {
    cut: -400,
    bulk: 300,
    recomp: 0,
    maintain: 0,
  }
  const targetKcal = Math.round(tdee + (adj[profile.goal_type ?? 'maintain'] ?? 0))
  const protein = Math.round(weightRef * 1.8)
  const fat = Math.round(weightRef * 0.9)
  const carb = Math.max(0, Math.round((targetKcal - protein * 4 - fat * 9) / 4))

  return { kcal: round0(targetKcal), protein, carb, fat }
}
