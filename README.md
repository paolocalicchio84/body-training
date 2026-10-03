# MyHealthyLife

Fork personale di Paolo: https://github.com/paolocalicchio84/body-training  
Upstream originale: https://github.com/daniele-pisciottano/maddaniello-physiquee

Live: https://pc-personaltrainer.netlify.app

Companion benessere personale — PWA web-only.

**Stack**: React 18 + Vite + TypeScript · Tailwind · Supabase (Auth/Postgres/pgvector) · Netlify Functions · OpenAI/Gemini (user-provided keys).

---

## Quick start locale

### 1. Dipendenze
```bash
npm install
```

### 2. Env vars
```bash
cp .env.example .env.local
```
Poi apri `.env.local` e inserisci dal progetto Supabase (Settings → API):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Applica lo schema DB
1. Apri Supabase → **SQL Editor** → **New query**
2. Esegui le migration **in ordine numerico**, da [`0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql) a `0013_exercise_seed.sql`: ognuna assume che le precedenti siano già applicate.
3. **Run** per ciascuna

Le migration sono idempotenti (`if not exists`, `on conflict do nothing`): rieseguirle non rompe nulla.

### 4. Config Supabase Auth
- Supabase → **Authentication → Providers → Email**: abilita "Email" provider
- (Opzionale per dev) Authentication → Email Templates: puoi disabilitare "Confirm email" per registrazioni immediate durante lo sviluppo

### 5. Avvia
```bash
npm run dev
```
Apri http://localhost:5173 → ti reindirizza a `/auth/signin`. Clicca "Registrati" e crea il primo account.

---

## Deploy Netlify

### Prima volta
1. Push del repo su GitHub
2. Netlify → **Add new site** → **Import an existing project** → scegli il repo
3. Build settings (dovrebbero essere già auto-rilevati da `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. **Environment variables** (Site settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - *(aggiunti in fasi successive)* `SUPABASE_SERVICE_ROLE_KEY`, `MASTER_ENCRYPTION_KEY`
5. Deploy

### Auth redirect URL in Supabase
In Supabase → Authentication → URL Configuration, aggiungi:
- Site URL: `https://<tuo-sito>.netlify.app`
- Redirect URLs: `https://<tuo-sito>.netlify.app/**`

---

## Struttura

```
maddaniello-physique/
├── public/                    # asset statici (favicon, icone PWA)
├── src/
│   ├── components/
│   │   ├── layout/            # AppShell, Sidebar, Topbar, BottomNav
│   │   └── ui/                # Button, Input, Label (shadcn-style)
│   ├── features/
│   │   └── auth/              # AuthProvider, useAuth
│   ├── lib/
│   │   ├── supabase.ts        # client Supabase
│   │   ├── queryClient.ts     # React Query config
│   │   └── utils.ts           # cn() helper
│   ├── routes/
│   │   ├── auth/              # SignIn, SignUp
│   │   ├── Home.tsx
│   │   └── ProtectedRoute.tsx
│   ├── App.tsx                # routing
│   ├── main.tsx               # entry
│   └── index.css              # Tailwind + CSS variables (dark sporty)
├── netlify/functions/         # API serverless (AI proxy in fasi successive)
├── supabase/migrations/       # schema SQL versionato
├── netlify.toml
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Roadmap fasi

| Fase | Stato | Contenuto |
|---|---|---|
| **0. Setup** | ✅ | Auth, layout, routing, PWA, design system |
| **12. Workout tracking** | ✅ | Libreria esercizi, schede, logger in-sessione, PR, volume per gruppo muscolare, coach AI |
| 1. Profilo & misure | ⏳ | CRUD profile, measurements, grafico peso, export JSON |
| 2. Food DB & log manuale | ⏳ | Open Food Facts, barcode scanner, custom foods, ricette |
| 3. Dashboard oggi | ⏳ | Anello kcal, barre macro, quick-add |
| 4. Impostazioni AI | ⏳ | API key cifrate (AES-256-GCM), scelta provider/modello, budget cap |
| 5. Log via chat AI | ⏳ | Parsing pasto via LLM, feedback loop, learned_corrections |
| 6. Companion chat | ⏳ | Context-aware (giorno/settimana/regole), prompt caching |
| 7. Knowledge base RAG | ⏳ | pgvector, embedding, chunk retrieval |
| 8. Training/sleep/integratori | ⏳ | Tracking complementare |
| 9. Fasi & review bisettimanale | ⏳ | Banner auto-review, applica suggerimenti |
| 10. Assessment iniziale + reset | ⏳ | Wizard, export/import, ricomincia |
| 11. Polish | ⏳ | Animazioni, offline queue, install prompt |

---

## Preview UI senza backend

```bash
npm run preview:ui
```

Avvia l'app su `localhost:5199` con Supabase e l'autenticazione sostituiti da mock e la cache di React Query pre-caricata con dati finti (`preview/fixtures.ts`). Serve a controllare layout e responsive — soprattutto il mobile — senza credenziali e senza toccare dati reali. Non fa parte della build di produzione: `npm run build` non vede la cartella `preview/`.

## Modulo allenamento

`/allenamento` è il tracking della sala pesi, sul modello di Hevy:

- **Libreria esercizi** (`exercise_catalog`): ~150 esercizi globali con nomi italiani e alias, più i custom dell'utente. Ogni esercizio porta i metadati biomeccanici (note, cue esecutivi, errori comuni con causa e correzione, controindicazioni) derivati da *Project Exercise*.
- **Schede e programmi** (`routine_folders` → `routines` → `routine_exercises` → `routine_sets`): superset, range di ripetizioni, RPE target, recuperi.
- **Logger in sessione** (`workout_sessions` → `session_exercises` → `session_sets`): serie con peso, ripetizioni, RPE/RIR, tipo serie (riscaldamento, drop, cedimento, back-off), timer di recupero, precompilazione con la prestazione precedente.
- **Record personali** (`personal_records`): massimale stimato con Epley, carico massimo, volume su singola serie. Rilevati automaticamente alla chiusura della sessione.
- **Statistiche**: serie settimanali per gruppo muscolare rispetto al riferimento 10-20, andamento del volume, curve di progressione per esercizio.

Completare una sessione crea anche la riga corrispondente in `workouts`, così Home, Andamento e il bilancio calorico continuano a funzionare senza doppia registrazione.

### Coach AI

`ai-training-coach` copre quattro azioni: analisi di una scheda, generazione di un programma (output JSON validato contro il catalogo reale, così non può inventare esercizi), preparazione della seduta successiva con carichi basati sullo storico, e punto della situazione sulle ultime 6 settimane.

> **Nota sui timeout**: le function sincrone di Netlify hanno un limite di **60 secondi**, non configurabile, sui piani credit-based (Free incluso). I vecchi piani *legacy* si fermano invece a 10s e non hanno le background functions: se il sito è ancora su un piano legacy, le chiamate AI lunghe (generazione programma, analisi foto) falliscono con un 502. In quel caso la soluzione è passare al piano Free credit-based, non modificare il codice.

## Knowledge base e ragionamenti

Il ragionamento dell'AI poggia su tre livelli, in `netlify/functions/_lib/`:

1. **`kb/`** — i principi di *Project Nutrition* (Biasci) e *Project Exercise* (Roncari) come blocchi tematici. `selectKnowledge()` inietta sempre i due nuclei e solo gli approfondimenti attivati dalla domanda, per non pagare l'intera dottrina a ogni messaggio.
2. **`coach/`** — motore di regole deterministico. Calcola kcal/kg, aderenza, velocità di variazione del peso, serie settimanali per gruppo muscolare, bilanciamento spinta/trazione e ginocchio/anca, stalli sui carichi. I verdetti arrivano al modello già calcolati (sezione *Rilievi automatici*), invece di essere dedotti a occhio.
3. **RAG** (`knowledge_docs` / `knowledge_chunks`) — i documenti caricati dall'utente, recuperati per similarità.

Le stesse analisi alimentano chat, coach allenamento e review di fase.

## Principi di progetto

- **Costi AI minimi**: modelli mini di default, prompt caching, DB-first/AI-fallback, cache interpretazioni, aggregati in SQL.
- **Privacy**: RLS attiva su tutto. API key AI cifrate a riposo in DB. Nessun tracking esterno.
- **Dark-first**: dark mode sempre attiva (no light mode toggle per ora).
- **Italiano**: tutta la UI.
- **PWA**: installabile mobile + desktop, no store.
