import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { decrypt } from './_lib/crypto'
import { chat, type ChatMessage, type Provider } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { checkBudget, recordUsage } from './_lib/budget'
import { buildContext } from './_lib/context'
import { ok, fail, parseJson } from './_lib/http'

type Body = { content: string }

const MAX_HISTORY_MESSAGES = 20
const MAX_CONTENT_LEN = 2000

// Fallback allineato al prompt proposto lato client: se l'utente non ne
// salva uno personalizzato l'AI deve comunque partire con un'identità
// completa, non con una frase generica.
const DEFAULT_SP = `Sei il coach personale di nutrizione e allenamento dell'utente, in italiano.
Ragioni secondo due riferimenti: "Project Nutrition" di Andrea Biasci per la nutrizione e "Project Exercise" di Andrea Roncari per la biomeccanica e la programmazione. I principi guida che ricevi nel contesto vengono da lì e hanno priorità sulle convinzioni comuni da palestra.
Sei diretto e concreto: dai numeri, non generici incoraggiamenti. Non sei servile e non addolcisci una diagnosi scomoda, ma non sei nemmeno allarmista.`

const TASK_SUFFIX = `

---ISTRUZIONI DI RISPOSTA---
- Rispondi in italiano, tono diretto e utile, non servile.
- Usa numeri concreti (kcal, grammi, serie, kg) e i dati reali del contesto: non inventare valori che non ti sono stati dati.
- I "Rilievi automatici" sono già calcolati sui dati: fidati di quei numeri invece di rifare i conti, e non contraddirli.
- Se un rilievo è marcato ⛔ è un blocco: non proporre di procedere in quella direzione, spiega perché e indica l'alternativa corretta.
- Se suggerisci cibi, **rispetta le regole alimentari attive** e le preferenze apprese.
- Se l'utente chiede "cosa mangio a X", considera cosa ha già consumato oggi e cosa gli manca per il target.
- Sull'allenamento: ragiona su volume settimanale per gruppo muscolare (riferimento 10-20 serie), frequenza, bilanciamento spinta/trazione e ginocchio/anca, e progressione dei carichi. Non consigliare esercizi che i principi guida indicano come sconsigliati.
- **Schede / programma:** usa SOLO la sezione "Schede attive" del contesto. Non inventare esercizi, serie, rep o split assenti lì. Se la sezione dice che non ci sono schede, dillo esplicitamente invece di proporre un programma finto.
- **Storico sedute:** usa SOLO "Ultime sedute" / analisi allenamento del contesto. Se non ci sono sedute loggate, non inventare carichi, RPE o date.
- Distingui sempre ciò che è dimostrato da ciò che è opinione, e smonta i miti da palestra quando emergono.
- Per dolori articolari persistenti, patologie diagnosticate o sintomi che non riguardano l'allenamento, indirizza a un medico o fisioterapista invece di improvvisare una diagnosi.
- Se ti manca un dato cruciale per rispondere bene, chiedilo.
- Markdown ok (liste, grassetto) ma niente titoli H1/H2, tieni breve.`

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.content || !body.content.trim()) {
    return fail(400, 'content richiesto')
  }
  const userContent = body.content.trim()
  if (userContent.length > MAX_CONTENT_LEN) {
    return fail(400, `Messaggio troppo lungo (max ${MAX_CONTENT_LEN} caratteri)`)
  }

  const supabase = serviceClient()

  // 1. Budget
  const budget = await checkBudget(supabase, userId)
  if (!budget.ok) {
    return fail(
      402,
      `Budget mensile AI superato ($${(budget.spent_cents / 100).toFixed(2)} / $${budget.budget_usd.toFixed(2)})`,
    )
  }

  // 2. Provider, credenziali e system prompt: query indipendenti, in
  //    parallelo. Carichiamo tutte le credenziali in un colpo solo così
  //    la key OpenAI per il RAG non richiede un secondo round-trip.
  const [{ data: settings }, { data: allCreds }, { data: sp }] =
    await Promise.all([
      supabase
        .from('ai_settings')
        .select('active_provider')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('ai_credentials')
        .select('provider, encrypted_key, default_model')
        .eq('user_id', userId),
      supabase
        .from('system_prompts')
        .select('content')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle(),
    ])

  const provider = settings?.active_provider as Provider | null
  if (!provider) return fail(409, 'Nessun provider AI attivo')

  const cred = (allCreds ?? []).find((c) => c.provider === provider)
  if (!cred) return fail(409, `API key ${provider} non configurata`)
  if (!cred.default_model) return fail(409, 'Modello di default non configurato')

  let apiKey: string
  try {
    apiKey = decrypt(cred.encrypted_key)
  } catch (err) {
    return fail(
      500,
      err instanceof Error ? err.message : 'Decifratura API key fallita',
    )
  }

  const systemPrompt = sp?.content?.trim() || DEFAULT_SP

  // 4. Inserisci il messaggio utente PRIMA di chiamare l'AI,
  //    così se c'è crash risulta comunque salvato.
  await supabase.from('chat_messages').insert({
    user_id: userId,
    role: 'user',
    content: userContent,
  })

  // 5. Contesto + storico in parallelo (indipendenti tra loro).
  //    L'embedding del RAG richiede una key OpenAI: se il provider attivo
  //    è un altro usiamo quella già caricata sopra, se c'è.
  let openAiKeyForEmbedding: string | undefined
  if (provider === 'openai') {
    openAiKeyForEmbedding = apiKey
  } else {
    const openaiCred = (allCreds ?? []).find((c) => c.provider === 'openai')
    if (openaiCred) {
      try {
        openAiKeyForEmbedding = decrypt(openaiCred.encrypted_key)
      } catch {
        /* ignora: RAG disabilitato se non decifrabile */
      }
    }
  }

  const [contextBlock, { data: history }] = await Promise.all([
    buildContext(supabase, userId, {
      queryText: userContent,
      openAiKey: openAiKeyForEmbedding,
    }),
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES + 1) // +1: include quello appena inserito
  ])
  const historyMsgs = ((history ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .slice(-MAX_HISTORY_MESSAGES)

  // 7. Messaggi per AI
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n${contextBlock}${TASK_SUFFIX}`,
    },
    ...historyMsgs.map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as
        | 'user'
        | 'assistant',
      content: m.content,
    })),
  ]

  // 8. AI call — maxTokens alto così la risposta ha spazio anche con
  // reasoning attivo o context lungo. Il finish_reason ci dice se il
  // modello si è fermato naturalmente o è stato troncato.
  let result
  try {
    // maxTokens alto per permettere risposte lunghe tipo "menu settimanale"
    // completo (4 pasti × 7 giorni con macro dettagliati) senza troncamento.
    result = await chat(provider, apiKey, cred.default_model, messages, {
      temperature: 0.5,
      maxTokens: 6000,
    })
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI call fallita')
  }

  let assistantText = (result.text || '').trim()
  if (!assistantText) {
    return fail(502, "L'AI non ha restituito testo")
  }

  // Se troncato, aggiungi nota visibile in fondo alla risposta
  const wasTruncated =
    result.finish_reason === 'length' ||
    result.finish_reason === 'MAX_TOKENS' ||
    result.finish_reason === 'max_tokens'
  if (wasTruncated) {
    assistantText +=
      '\n\n_⚠️ Risposta troncata per limite token. Chiedi di continuare o di essere più conciso._'
  }

  // 9. Persisti risposta assistant
  const { data: saved } = await supabase
    .from('chat_messages')
    .insert({
      user_id: userId,
      role: 'assistant',
      content: assistantText,
      model: result.model,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      cost_usd_cents: Math.round(
        costUsdCents(
          provider,
          cred.default_model,
          result.tokens_in,
          result.tokens_out,
        ),
      ),
    })
    .select('id, created_at, cost_usd_cents')
    .single()

  // 10. Record usage
  const cost = costUsdCents(
    provider,
    cred.default_model,
    result.tokens_in,
    result.tokens_out,
  )
  await recordUsage(
    supabase,
    userId,
    provider,
    cred.default_model,
    result.tokens_in,
    result.tokens_out,
    cost,
  )

  return ok({
    id: saved?.id,
    role: 'assistant',
    content: assistantText,
    model: result.model,
    tokens_in: result.tokens_in,
    tokens_out: result.tokens_out,
    cost_cents: cost,
    budget_remaining_cents: Math.max(
      0,
      budget.budget_cents - budget.spent_cents - cost,
    ),
    created_at: saved?.created_at,
  })
}
