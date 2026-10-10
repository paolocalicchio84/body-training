// Costruisce un blocco di contesto utente compatto per l'AI.
// Viene ricostruito ad ogni chat call (profilo/pasti/regole cambiano).

import type { SupabaseClient } from '@supabase/supabase-js'
import { embedTexts, embeddingCostCents } from './embeddings'
import { recordUsage } from './budget'
import { selectKnowledge } from './kb'
import {
  analyzeNutrition,
  formatFindings,
  type NutritionFacts,
} from './coach/nutrition-rules'
import {
  analyzeTraining,
  formatTrainingContext,
} from './coach/training-rules'
import {
  formatActiveRoutines,
  formatRecentSessions,
  loadActiveRoutines,
  loadTrainingSets,
} from './coach/training-data'

// Finestra di analisi dell'allenamento: 4 settimane è il minimo per
// leggere volume settimanale e progressioni senza rumore.
const TRAINING_WEEKS = 4

type Profile = {
  sex: 'male' | 'female' | 'other' | null
  birth_date: string | null
  height_cm: number | null
  activity_level: string | null
  goal_type: string | null
  goal_weight_kg: number | null
  goal_body_fat_pct: number | null
  goal_deadline: string | null
  target_kcal: number | null
  target_protein_g: number | null
  target_carb_g: number | null
  target_fat_g: number | null
}

type Measurement = {
  measured_at: string
  weight_kg: number | null
  body_fat_pct: number | null
  body_fat_scale_pct: number | null
  body_fat_visual_pct: number | null
}

type MealEntry = {
  eaten_at: string
  meal_type: string
  food_name: string
  grams: number | null
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
}

type DietaryRule = {
  rule_type: string
  rule_value: Record<string, unknown>
  notes: string | null
}

type LearnedCorrection = {
  scope: string
  content: string
}

type WorkoutRow = {
  started_at: string
  duration_min: number
  workout_type: string
  intensity: string | null
  kcal_burned: number | null
}

type SleepRow = {
  sleep_date: string
  hours: number
  quality: number | null
}

type MealPlanRow = {
  meal_type: string
  slot_label: string
  options: string[]
  portion_hint: string | null
  notes: string | null
  position: number
}

type DailyNoteRow = {
  note_date: string
  body: string
  energy: number | null
}

export async function buildContext(
  supabase: SupabaseClient,
  userId: string,
  opts?: {
    // Se fornito, tenta retrieval RAG dalla knowledge base usando
    // queryText come query (embedding + pgvector match). Richiede
    // openAiKey per calcolare l'embedding.
    queryText?: string
    openAiKey?: string
  },
): Promise<string> {
  const [
    profile,
    measurements,
    allWeekMeals,
    rules,
    corrections,
    weekWorkouts,
    weekSleep,
    mealPlan,
    knowledgeHits,
    training,
    activeRoutines,
    weekDailyNotes,
  ] = await Promise.all([
    loadProfile(supabase, userId),
    loadRecentMeasurements(supabase, userId),
    // I pasti di oggi sono un sottoinsieme della settimana: una query sola.
    loadWeekMeals(supabase, userId),
    loadActiveRules(supabase, userId),
    loadActiveCorrections(supabase, userId),
    loadWeekWorkouts(supabase, userId),
    loadWeekSleep(supabase, userId),
    loadMealPlan(supabase, userId),
    retrieveKnowledge(supabase, userId, opts),
    loadTrainingSets(supabase, userId, TRAINING_WEEKS),
    loadActiveRoutines(supabase, userId),
    loadWeekDailyNotes(supabase, userId),
  ])

  const latestMeasurement = measurements[0] ?? null
  const todayKey = localDayKey(new Date())
  const todayMeals = allWeekMeals.filter(
    (m) => localDayKey(new Date(m.eaten_at)) === todayKey,
  )
  const weekMeals = allWeekMeals

  const parts: string[] = []
  const now = new Date()
  const todayIso = todayKey
  parts.push(`# Contesto attuale (${formatDate(now)})`)

  // --- Profilo ---
  if (profile) {
    const p: string[] = []
    if (profile.sex) p.push(`sesso ${labelSex(profile.sex)}`)
    if (profile.birth_date) p.push(`età ${yearsOld(profile.birth_date)} anni`)
    if (profile.height_cm) p.push(`altezza ${profile.height_cm} cm`)
    if (profile.activity_level) p.push(`attività ${profile.activity_level}`)
    if (latestMeasurement?.weight_kg != null) {
      p.push(`peso ${Number(latestMeasurement.weight_kg)} kg`)
    }
    if (latestMeasurement?.body_fat_visual_pct != null) {
      p.push(`body fat visuale ${Number(latestMeasurement.body_fat_visual_pct)}%`)
    }
    if (latestMeasurement?.body_fat_scale_pct != null) {
      p.push(`body fat bilancia ${Number(latestMeasurement.body_fat_scale_pct)}%`)
    }
    if (
      latestMeasurement?.body_fat_visual_pct == null &&
      latestMeasurement?.body_fat_scale_pct == null &&
      latestMeasurement?.body_fat_pct != null
    ) {
      p.push(`body fat ${Number(latestMeasurement.body_fat_pct)}%`)
    }
    if (p.length > 0) {
      parts.push('## Profilo\n' + p.join(', '))
    }

    // --- Obiettivo ---
    const g: string[] = []
    if (profile.goal_type) g.push(`fase ${profile.goal_type}`)
    if (profile.goal_weight_kg != null) {
      g.push(`peso target ${profile.goal_weight_kg} kg`)
    }
    if (profile.goal_body_fat_pct != null) {
      g.push(`BF target ${profile.goal_body_fat_pct}%`)
    }
    if (profile.goal_deadline) g.push(`entro ${profile.goal_deadline}`)
    if (g.length > 0) {
      parts.push('## Obiettivo\n' + g.join(', '))
    }

    // --- Target macro giornalieri ---
    if (
      profile.target_kcal ||
      profile.target_protein_g ||
      profile.target_carb_g ||
      profile.target_fat_g
    ) {
      const t: string[] = []
      if (profile.target_kcal) t.push(`${profile.target_kcal} kcal`)
      if (profile.target_protein_g) t.push(`P ${profile.target_protein_g}g`)
      if (profile.target_carb_g) t.push(`C ${profile.target_carb_g}g`)
      if (profile.target_fat_g) t.push(`G ${profile.target_fat_g}g`)
      parts.push('## Target giornaliero\n' + t.join(' · '))
    }
  }

  // --- Oggi: totali + pasti ---
  const todayTotals = sumMeals(todayMeals)
  const targetK = profile?.target_kcal ?? null
  const targetP = profile?.target_protein_g ?? null
  const targetC = profile?.target_carb_g ?? null
  const targetF = profile?.target_fat_g ?? null

  parts.push('## Oggi — stato')
  if (todayMeals.length === 0) {
    parts.push('Nessun pasto loggato oggi.')
  } else {
    parts.push(
      `Consumato: ${round0(todayTotals.kcal)} kcal · ${round0(todayTotals.protein)}g P · ${round0(todayTotals.carb)}g C · ${round0(todayTotals.fat)}g G`,
    )
    const rem: string[] = []
    if (targetK) rem.push(`${round0(targetK - todayTotals.kcal)} kcal`)
    if (targetP) rem.push(`${round0(targetP - todayTotals.protein)}g P`)
    if (targetC) rem.push(`${round0(targetC - todayTotals.carb)}g C`)
    if (targetF) rem.push(`${round0(targetF - todayTotals.fat)}g G`)
    if (rem.length > 0) parts.push(`Residui a target: ${rem.join(' · ')}`)
    parts.push('Pasti:')
    for (const m of todayMeals) {
      const time = m.eaten_at.slice(11, 16)
      const grams = m.grams ? `${round0(Number(m.grams))}g` : '—'
      parts.push(
        `- ${time} ${labelMealType(m.meal_type)}: ${m.food_name} · ${grams} · ${round0(m.kcal)} kcal, ${round0(m.protein_g)}g P`,
      )
    }
  }

  // --- Ultimi 7 giorni: elenco compatto ---
  if (weekMeals.length > 0) {
    const byDay = new Map<string, MealEntry[]>()
    for (const m of weekMeals) {
      const day = localDayKey(new Date(m.eaten_at))
      if (day === todayIso) continue
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(m)
    }
    if (byDay.size > 0) {
      parts.push('## Ultimi 7 giorni')
      const sorted = Array.from(byDay.entries()).sort((a, b) =>
        b[0].localeCompare(a[0]),
      )
      for (const [day, meals] of sorted) {
        const tot = sumMeals(meals)
        const items = meals
          .map((m) => m.food_name)
          .slice(0, 6)
          .join(', ')
        parts.push(
          `- ${day} (${round0(tot.kcal)} kcal): ${items}${meals.length > 6 ? '…' : ''}`,
        )
      }

      // Counts per keyword (carne/pesce/uova/ecc) — semplici heuristiche
      const counts = countKeywords(weekMeals)
      if (Object.keys(counts).length > 0) {
        parts.push(
          'Frequenza categorie (last 7d): ' +
            Object.entries(counts)
              .map(([k, v]) => `${k} ${v}x`)
              .join(', '),
        )
      }
    }
  }

  // --- Schede pianificate (programma / split) ---
  // Senza questo blocco la chat inventa la "scheda attuale".
  parts.push(formatActiveRoutines(activeRoutines))

  // --- Allenamento strutturato: analisi calcolata, non dedotta ---
  const trainingAnalysis = analyzeTraining(
    training.sets,
    TRAINING_WEEKS,
    training.sessions.length,
  )
  if (training.sessions.length > 0) {
    parts.push(formatTrainingContext(trainingAnalysis, TRAINING_WEEKS))
    const recent = formatRecentSessions(training.sessions, training.sets)
    if (recent.length > 0) {
      parts.push('### Ultime sedute\n' + recent.join('\n'))
    }
  } else {
    parts.push(
      `## Allenamento loggato (ultime ${TRAINING_WEEKS} settimane)\n` +
        'Nessuna seduta completata nel periodo. Non inventare log, carichi o progressioni: se servono, chiedili all\'utente.',
    )
  }

  // --- Allenamenti generici / cardio (ultimi 7 giorni) ---
  if (weekWorkouts.length > 0) {
    const totalMin = weekWorkouts.reduce((s, w) => s + w.duration_min, 0)
    parts.push('## Altre attività, cardio e sport (ultimi 7 giorni)')
    parts.push(
      `Totale: ${weekWorkouts.length} sessioni, ${totalMin} min.`,
    )
    for (const w of weekWorkouts.slice(0, 10)) {
      const day = w.started_at.slice(0, 10)
      parts.push(
        `- ${day}: ${w.workout_type} · ${w.duration_min}min${w.intensity ? ` · ${w.intensity}` : ''}${w.kcal_burned != null ? ` · ~${w.kcal_burned} kcal` : ''}`,
      )
    }
  }

  // --- Sonno (ultimi 7 giorni) ---
  if (weekSleep.length > 0) {
    const avg =
      weekSleep.reduce((s, e) => s + Number(e.hours), 0) / weekSleep.length
    const qualityAvg =
      weekSleep.filter((e) => e.quality != null).reduce((s, e) => s + (e.quality ?? 0), 0) /
      (weekSleep.filter((e) => e.quality != null).length || 1)
    parts.push('## Sonno (ultimi 7 giorni)')
    parts.push(
      `Media: ${avg.toFixed(1)}h${qualityAvg > 0 ? ` · qualità ${qualityAvg.toFixed(1)}/5` : ''} · ${weekSleep.length} notti tracciate`,
    )
  }

  // --- Diario giornaliero (note + energia) ---
  if (weekDailyNotes.length > 0) {
    const todayNote = weekDailyNotes.find((n) => n.note_date === todayIso)
    parts.push('## Diario giornaliero')
    if (todayNote) {
      const energy =
        todayNote.energy != null ? ` · energia ${todayNote.energy}/5` : ''
      const body = todayNote.body.trim()
      parts.push(
        `Oggi${energy}: ${body || '(solo energia, nessun testo)'}`,
      )
    } else {
      parts.push('Nessuna nota per oggi.')
    }
    const older = weekDailyNotes.filter((n) => n.note_date !== todayIso)
    if (older.length > 0) {
      parts.push('Ultimi giorni:')
      for (const n of older.slice(0, 6)) {
        const energy = n.energy != null ? ` · E${n.energy}/5` : ''
        const body = n.body.trim()
        const preview =
          body.length > 120 ? `${body.slice(0, 117)}…` : body || '(solo energia)'
        parts.push(`- ${n.note_date}${energy}: ${preview}`)
      }
    }
  }

  // --- Piano alimentare (alimenti previsti per pasto) ---
  if (mealPlan.length > 0) {
    parts.push('## Piano alimentare (alimenti previsti per pasto)')
    parts.push(
      "Queste sono le scelte abituali/previste dell'utente. Usale come prima fonte quando suggerisci un pasto: propone combinazioni di queste alternative rispettando macro e regole. Cambia opzione se aiuta la varietà settimanale.",
    )
    const byMeal = new Map<string, MealPlanRow[]>()
    for (const s of mealPlan) {
      if (!byMeal.has(s.meal_type)) byMeal.set(s.meal_type, [])
      byMeal.get(s.meal_type)!.push(s)
    }
    const order = ['breakfast', 'lunch', 'dinner', 'snack']
    for (const mt of order) {
      const slots = byMeal.get(mt)
      if (!slots || slots.length === 0) continue
      parts.push(`### ${labelMealType(mt)}`)
      for (const s of slots.sort((a, b) => a.position - b.position)) {
        const portion = s.portion_hint ? ` (${s.portion_hint})` : ''
        const options = s.options.join(' | ')
        const notes = s.notes ? ` — ${s.notes}` : ''
        parts.push(`- **${s.slot_label}**${portion}: ${options}${notes}`)
      }
    }
  }

  // --- Regole dietetiche ---
  if (rules.length > 0) {
    parts.push('## Regole alimentari attive')
    for (const r of rules) {
      parts.push(`- ${formatRule(r)}`)
    }
  }

  // --- Correzioni apprese ---
  if (corrections.length > 0) {
    parts.push('## Preferenze e correzioni apprese')
    for (const c of corrections) {
      parts.push(`- [${c.scope}] ${c.content}`)
    }
  }

  // --- Analisi automatica: verdetti già calcolati ---
  // Passiamo al modello conclusioni deterministiche (kcal/kg, aderenza,
  // volume, squilibri) invece di lasciargliele ricavare a occhio.
  const nutritionFacts = buildNutritionFacts(profile, measurements, weekMeals)
  const nutritionAnalysis = analyzeNutrition(nutritionFacts)

  const derived: string[] = []
  if (nutritionAnalysis.kcalPerKg != null) {
    derived.push(`Introito target: ${nutritionAnalysis.kcalPerKg} kcal/kg`)
  }
  if (nutritionAnalysis.proteinPerKg != null) {
    derived.push(`Proteine target: ${nutritionAnalysis.proteinPerKg} g/kg`)
  }
  if (nutritionAnalysis.weeklyWeightChangePct != null) {
    derived.push(
      `Variazione peso: ${nutritionAnalysis.weeklyWeightChangePct}%/settimana (su 28 giorni)`,
    )
  }
  if (derived.length > 0) {
    parts.push('## Indicatori calcolati\n' + derived.join(' · '))
  }

  const allFindings = [
    ...nutritionAnalysis.findings,
    ...trainingAnalysis.findings.filter((f) => f.code !== 'no_training_data'),
  ]
  const findingsBlock = formatFindings(
    allFindings,
    'Rilievi automatici (già verificati sui dati)',
  )
  if (findingsBlock) {
    parts.push(
      findingsBlock +
        '\n\nQuesti rilievi sono calcolati sui dati reali: tienine conto nella risposta, ma citali solo se pertinenti alla domanda.',
    )
  }

  // --- Principi guida dai libri di riferimento ---
  const kb = selectKnowledge(opts?.queryText ?? '', {
    includeTraining: training.sessions.length > 0,
  })
  parts.push(kb.text)

  // --- Knowledge base (RAG) ---
  if (knowledgeHits.length > 0) {
    parts.push('## Knowledge base — passaggi rilevanti')
    parts.push(
      "Questi estratti vengono dai documenti che hai caricato. Usali come fonte primaria quando pertinenti, citando il titolo del documento.",
    )
    for (const h of knowledgeHits) {
      parts.push(
        `### da "${h.doc_title}" (similarity ${(h.similarity * 100).toFixed(0)}%)\n${h.chunk_text}`,
      )
    }
  }

  return parts.join('\n\n')
}

// --------------------------------------------------------------
// Loaders
// --------------------------------------------------------------
async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profile')
    .select(
      'sex, birth_date, height_cm, activity_level, goal_type, goal_weight_kg, goal_body_fat_pct, goal_deadline, target_kcal, target_protein_g, target_carb_g, target_fat_g',
    )
    .eq('user_id', userId)
    .maybeSingle()
  return (data as Profile) ?? null
}

// Ultime misure: la più recente serve al profilo, le altre a calcolare
// il trend di peso su 28 giorni per i rilievi automatici.
async function loadRecentMeasurements(
  supabase: SupabaseClient,
  userId: string,
): Promise<Measurement[]> {
  const { data } = await supabase
    .from('measurements')
    .select(
      'measured_at, weight_kg, body_fat_pct, body_fat_scale_pct, body_fat_visual_pct',
    )
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(40)
  return (data as Measurement[]) ?? []
}

async function loadWeekMeals(
  supabase: SupabaseClient,
  userId: string,
): Promise<MealEntry[]> {
  const start = new Date()
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('meal_entries')
    .select(
      'eaten_at, meal_type, food_name, grams, kcal, protein_g, carb_g, fat_g',
    )
    .eq('user_id', userId)
    .gte('eaten_at', start.toISOString())
    .order('eaten_at')
  return (data as MealEntry[]) ?? []
}

async function loadActiveRules(
  supabase: SupabaseClient,
  userId: string,
): Promise<DietaryRule[]> {
  const { data } = await supabase
    .from('dietary_rules')
    .select('rule_type, rule_value, notes')
    .eq('user_id', userId)
    .eq('active', true)
  return (data as DietaryRule[]) ?? []
}

async function loadActiveCorrections(
  supabase: SupabaseClient,
  userId: string,
): Promise<LearnedCorrection[]> {
  const { data } = await supabase
    .from('learned_corrections')
    .select('scope, content')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(30)
  return (data as LearnedCorrection[]) ?? []
}

async function loadWeekWorkouts(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkoutRow[]> {
  const start = new Date()
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  // Le righe con session_id sono lo specchio di una sessione strutturata,
  // già raccontata in dettaglio nella sezione precedente: includerle qui
  // farebbe contare al modello lo stesso allenamento due volte.
  const { data } = await supabase
    .from('workouts')
    .select('started_at, duration_min, workout_type, intensity, kcal_burned')
    .eq('user_id', userId)
    .is('session_id', null)
    .gte('started_at', start.toISOString())
    .order('started_at', { ascending: false })
  return (data as WorkoutRow[]) ?? []
}

type KnowledgeHit = {
  doc_id: string
  chunk_text: string
  similarity: number
  doc_title: string
}

async function retrieveKnowledge(
  supabase: SupabaseClient,
  userId: string,
  opts?: { queryText?: string; openAiKey?: string },
): Promise<KnowledgeHit[]> {
  if (!opts?.queryText || !opts.openAiKey) return []
  const query = opts.queryText.trim().slice(0, 2000)
  if (!query) return []

  try {
    // Embed la query
    const { embeddings, tokens_in } = await embedTexts(opts.openAiKey, [query])
    if (!embeddings[0]) return []

    // Il costo dell'embedding va contabilizzato: altrimenti il budget
    // mensile sottostima il consumo reale a ogni messaggio di chat.
    if (tokens_in > 0) {
      await recordUsage(
        supabase,
        userId,
        'openai',
        'text-embedding-3-small',
        tokens_in,
        0,
        embeddingCostCents(tokens_in),
      )
    }

    // Similarity search via RPC
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: embeddings[0],
      match_user_id: userId,
      match_threshold: 0.25,
      match_count: 3,
    })
    if (error) {
      console.error('match_knowledge_chunks error:', error.message)
      return []
    }
    return (data ?? []) as KnowledgeHit[]
  } catch (err) {
    console.error('retrieveKnowledge failed:', err)
    return []
  }
}

async function loadMealPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<MealPlanRow[]> {
  const { data } = await supabase
    .from('meal_plan_slots')
    .select('meal_type, slot_label, options, portion_hint, notes, position')
    .eq('user_id', userId)
    .eq('active', true)
    .order('meal_type')
    .order('position')
  return (data as MealPlanRow[]) ?? []
}

async function loadWeekSleep(
  supabase: SupabaseClient,
  userId: string,
): Promise<SleepRow[]> {
  const start = new Date()
  start.setDate(start.getDate() - 6)
  const startDate = start.toISOString().slice(0, 10)
  const { data } = await supabase
    .from('sleep_entries')
    .select('sleep_date, hours, quality')
    .eq('user_id', userId)
    .gte('sleep_date', startDate)
    .order('sleep_date', { ascending: false })
  return (data as SleepRow[]) ?? []
}

async function loadWeekDailyNotes(
  supabase: SupabaseClient,
  userId: string,
): Promise<DailyNoteRow[]> {
  const start = new Date()
  start.setDate(start.getDate() - 6)
  const startDate = localDayKey(start)
  const { data, error } = await supabase
    .from('daily_notes')
    .select('note_date, body, energy')
    .eq('user_id', userId)
    .gte('note_date', startDate)
    .order('note_date', { ascending: false })
  if (error) {
    // Tabella assente finché Paolo non applica 0014 — non far fallire la chat.
    console.error('loadWeekDailyNotes:', error.message)
    return []
  }
  return (data as DailyNoteRow[]) ?? []
}

// --------------------------------------------------------------
// Utils
// --------------------------------------------------------------

// Le Netlify Functions girano in UTC: senza forzare il fuso, tra
// mezzanotte e le 2 italiane "oggi" per l'AI sarebbe il giorno prima.
const APP_TZ = 'Europe/Rome'

function localDayKey(d: Date): string {
  // en-CA produce direttamente il formato YYYY-MM-DD.
  return d.toLocaleDateString('en-CA', { timeZone: APP_TZ })
}

// Costruisce l'input del motore di regole nutrizionali.
function buildNutritionFacts(
  profile: Profile | null,
  measurements: Measurement[],
  weekMeals: MealEntry[],
): NutritionFacts {
  const latest = measurements[0] ?? null
  const weightKg = latest?.weight_kg != null ? Number(latest.weight_kg) : null

  // Peso di 28 giorni fa: la misura più vicina a quella data.
  let weightDelta28d: number | null = null
  if (weightKg != null) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 28)
    const cutoffKey = cutoff.toISOString().slice(0, 10)
    const older = measurements.find(
      (m) => m.measured_at <= cutoffKey && m.weight_kg != null,
    )
    if (older?.weight_kg != null) {
      weightDelta28d = Math.round((weightKg - Number(older.weight_kg)) * 100) / 100
    }
  }

  // Medie sui soli giorni effettivamente loggati.
  const byDay = new Map<string, { kcal: number; protein: number }>()
  for (const m of weekMeals) {
    const day = localDayKey(new Date(m.eaten_at))
    const cur = byDay.get(day) ?? { kcal: 0, protein: 0 }
    cur.kcal += Number(m.kcal)
    cur.protein += Number(m.protein_g)
    byDay.set(day, cur)
  }
  const days = [...byDay.values()]
  const avgKcal7d =
    days.length > 0
      ? Math.round(days.reduce((s, d) => s + d.kcal, 0) / days.length)
      : null
  const avgProtein7d =
    days.length > 0
      ? Math.round(days.reduce((s, d) => s + d.protein, 0) / days.length)
      : null

  const bf =
    latest?.body_fat_visual_pct ??
    latest?.body_fat_scale_pct ??
    latest?.body_fat_pct ??
    null

  return {
    sex: profile?.sex ?? null,
    weightKg,
    bodyFatPct: bf != null ? Number(bf) : null,
    goalType: profile?.goal_type ?? null,
    targetKcal: profile?.target_kcal ?? null,
    targetProteinG: profile?.target_protein_g ?? null,
    targetFatG: profile?.target_fat_g ?? null,
    avgKcal7d,
    avgProtein7d,
    daysLogged7d: days.length,
    weightDelta28d,
  }
}

function yearsOld(birthDateIso: string): number {
  const b = new Date(birthDateIso)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

function labelSex(s: string): string {
  return s === 'male' ? 'uomo' : s === 'female' ? 'donna' : 'altro'
}

function labelMealType(t: string): string {
  return {
    breakfast: 'colazione',
    lunch: 'pranzo',
    dinner: 'cena',
    snack: 'spuntino',
  }[t] ?? t
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  })
}

function round0(n: number): number {
  return Math.round(Number(n))
}

function sumMeals(meals: MealEntry[]) {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + Number(m.kcal),
      protein: acc.protein + Number(m.protein_g),
      carb: acc.carb + Number(m.carb_g),
      fat: acc.fat + Number(m.fat_g),
    }),
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  )
}

function formatRule(r: DietaryRule): string {
  const val = r.rule_value as Record<string, unknown>
  const target =
    (val.target as string) ||
    (val.food_tag as string) ||
    (val.ingredient as string) ||
    '?'
  const n = val.value ?? val.count ?? '?'
  const notes = r.notes ? ` (${r.notes})` : ''
  switch (r.rule_type) {
    case 'max_per_week':
      return `Max ${n}x/settimana: ${target}${notes}`
    case 'max_per_day':
      return `Max ${n}x/giorno: ${target}${notes}`
    case 'min_per_day':
      return `Min ${n}x/giorno: ${target}${notes}`
    case 'exclude':
      return `Escludi: ${target}${notes}`
    case 'prefer':
      return `Preferisci: ${target}${notes}`
    default:
      return `${r.rule_type}: ${JSON.stringify(val)}`
  }
}

// Heuristics molto semplici per categorizzare i pasti della settimana.
function countKeywords(meals: MealEntry[]): Record<string, number> {
  const keywords: Record<string, string[]> = {
    carne: ['pollo', 'tacchino', 'manzo', 'vitello', 'maiale', 'agnello', 'prosciutto', 'salsiccia', 'carne', 'hamburger', 'bresaola'],
    pesce: ['pesce', 'tonno', 'salmone', 'merluzzo', 'orata', 'branzino', 'gamberi', 'acciughe'],
    uova: ['uovo', 'uova', 'frittata', 'omelette'],
    latticini: ['yogurt', 'latte', 'formaggio', 'ricotta', 'mozzarella', 'feta', 'parmigiano', 'grana'],
    legumi: ['lenticchie', 'ceci', 'fagioli', 'piselli', 'soia', 'tofu'],
    frutta: ['mela', 'banana', 'arancia', 'pera', 'kiwi', 'fragole', 'ananas'],
  }
  const counts: Record<string, number> = {}
  for (const m of meals) {
    const name = m.food_name.toLowerCase()
    for (const [cat, kws] of Object.entries(keywords)) {
      if (kws.some((k) => name.includes(k))) {
        counts[cat] = (counts[cat] ?? 0) + 1
        break
      }
    }
  }
  return counts
}
