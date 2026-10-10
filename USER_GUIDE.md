# MyHealthyLife — Guida all'uso

Companion benessere personale AI (nutrizione + allenamento). Traccia alimentazione, schede, sonno, misure; l'AI analizza lo storico e suggerisce aggiustamenti basati su target, regole e piano alimentare.

**Live:** https://pc-personaltrainer.netlify.app

---

## Indice

0. [Guida in-app](#guida-in-app)
1. [Setup iniziale](#setup-iniziale)
2. [Panoramica sezioni](#panoramica-sezioni)
3. [Flusso giornaliero consigliato](#flusso-giornaliero-consigliato)
4. [Flusso settimanale](#flusso-settimanale)
5. [Come sfruttare l'AI al meglio](#come-sfruttare-lai-al-meglio)
6. [Costi AI e budget](#costi-ai-e-budget)
7. [Troubleshooting](#troubleshooting)

---

## Guida in-app

Al primo accesso parte da sola una guida in dieci passaggi: cosa fa l'app, la checklist di configurazione (che mostra quali passaggi hai già completato davvero) e una scheda per ogni sezione principale, con il pulsante per saltarci dentro.

Puoi rilanciarla quando vuoi da **Impostazioni → Guida all'uso → Rivedi la guida**: riparte sempre dall'inizio, quindi è anche il modo per ricontrollarla dopo averla saltata.

Per la singola sezione c'è il pulsante **?** accanto all'etichetta in cima a ogni pagina: apre la spiegazione di quella sezione soltanto, senza far ripartire tutto il tour.

## Setup iniziale

### 1. Registrazione e primo accesso

1. Vai su https://pc-personaltrainer.netlify.app
2. **Registrati** con email + password. Se la conferma email è attiva su Supabase, controlla la casella.
3. Accedi. Se dimentichi la password: **Password dimenticata?** su Sign-in (link email Supabase) oppure reset da Supabase → Authentication → Users.

### 2. Assessment wizard (5 step)

La prima volta dovresti vedere un card "Completa l'assessment iniziale" sulla Home. Click → ti guida in 5 passi:

- **Profilo**: sesso, data di nascita, altezza, livello di attività
- **Obiettivo**: fase (cut/bulk/recomp/maintain), peso target, body fat target, scadenza
- **Prima misura**: peso attuale + body fat opzionale (puoi saltare)
- **Target**: calcolati automaticamente con Mifflin-St Jeor × attività × aggiustamento fase (cut -400 / bulk +300). Modificabili.
- **Fatto**: riepilogo e link ai prossimi step

Tutto viene salvato passo per passo, quindi puoi interrompere senza perdere progressi.

### 3. Configura Gemini (consigliato — percorso preferito)

Vai su **Impostazioni → AI & modelli** (badge **Consigliato: Gemini**).

1. Incolla la key Gemini (`AIza...`) da https://aistudio.google.com/apikey
2. Clicca **Testa** → lista dei modelli
3. Seleziona un modello flash (es. `gemini-2.0-flash`)
4. **Salva e connetti**
5. Imposta **Provider attivo = Gemini**

OpenAI resta opzionale (embedding / knowledge base documenti). Chat e parse pasti funzionano con solo Gemini.

- **Budget mensile**: default 5$, tipicamente 1–2$ bastano.

**Nota**: la knowledge base RAG documenti utente richiede embedding OpenAI. Con solo Gemini, chat e parsing funzionano ma la retrieval documenti è disattivata.

### 4. Piano alimentare (consigliato dopo qualche giorno)

Vai su **Impostazioni → Piano alimentare**. Per ogni pasto definisci "slot" con alternative:

Esempio colazione:
- **Carbo** (40-60g): `fiocchi d'avena, fette biscottate, cereali integrali`
- **Proteine** (150g): `yogurt greco, latte scremato`
- **Extra**: `frutta di stagione, miele`

L'AI userà queste alternative come prima fonte quando suggerisce pasti. Chi non ha piano alimentare riceve suggerimenti più generici.

### 5. Regole alimentari (opzionale)

Vai su **Impostazioni → Regole alimentari**. Tipi:
- `Max per settimana`: "max 3× carne"
- `Max per giorno`: "max 2× caffè"
- `Min per giorno`: "min 5 porzioni di verdura"
- `Escludi`: "no alcol"
- `Preferisci`: "preferisci grassi insaturi"

L'AI le vede in ogni chat e le rispetta quando suggerisce.

---

## Panoramica sezioni

### Oggi (Home)

La dashboard principale. Mostra:
- **4 card macro** (Kcal, Proteine, Carbo, Grassi) con totale attuale vs target e "mancano Xg"
- **Peso attuale vs target** con delta vs misura precedente
- **Note del giorno**: testo libero + energia 1–5 (salvate per data; l'AI le vede in chat)
- **Banner contestuali**: completa assessment, imposta target, aggiungi misura, logga primo pasto, è ora di ripesarti, revisione bisettimanale dovuta/pendente

Accesso rapido alle sezioni principali dalla bottom nav (mobile) o sidebar (desktop).

### Pasti (`/meals`)

Log dei pasti giornaliero.

- **Navigazione data**: frecce ← →, bottone "Oggi"
- **Totali del giorno**: kcal + macro, rispetto al target
- **Pasti raggruppati** per tipo (colazione/pranzo/cena/spuntini), ciascuno con subtotali
- **FAB "+"** in basso a destra: apre il dialog aggiunta pasto

#### Come aggiungere un pasto

Dialog con 5 tab (il primo è "AI" per default):

**AI** — Il più veloce per pasti complessi.
Scrivi in linguaggio naturale ("pranzo: 150g riso basmati, petto di pollo 200g, 10g olio, insalata"). L'AI restituisce:
- Lista items con macro stimati per ognuno
- Confidence per item (verde ≥70%, giallo altrimenti)
- Badge "match locale" se l'AI ha collegato a un tuo alimento custom
- Puoi modificare nome e grammi (i macro scalano), rimuovere item con ×
- "Aggiungi N voci" → crea N meal entry in un batch

**Cerca** — Per alimenti singoli che ricorrono.
- Input di ricerca: cerca negli alimenti custom (locali) mentre scrivi
- Bottone "Cerca su OFF": query a Open Food Facts italiano
- Click su un risultato → form grammi con preview macro live
- Conferma

**Codice a barre** — Per prodotti confezionati.
- Apre la fotocamera, scansiona il codice EAN/UPC
- **Prima cerca localmente** (se hai già salvato quel codice, lo ritrova istantaneo)
- Poi OFF
- Se non trovato → banner con "Aggiungi manualmente questo prodotto": form minimal (nome, brand, macro/100g); viene **salvato legato al codice** quindi la prossima scansione lo ritrova subito

**Rapido** — Per entries veloci non in database.
- Nome + grammi + macro diretti
- Kcal auto-calcolate da P·4 + C·4 + G·9 se lasci vuoto
- Checkbox "Salva come alimento custom riutilizzabile"

**Ricetta** — Per pasti composti riutilizzabili.
- Pick da una tua ricetta
- Porzioni (default 1) → scala i macro
- Conferma

### Ricette (`/recipes`)

Composizioni riutilizzabili (es. "Pollo e riso", "Colazione tipo").

- **Nuova ricetta**: nome + porzioni totali + note
- **Aggiungi ingrediente**: apre un mini-dialog con le stesse tab di aggiunta pasto (Cerca/Codice a barre/Rapido) — niente più "solo manuale"
- Per ogni ingrediente puoi aggiustare grammi dopo (i macro ricalcolano automaticamente se è collegato a un alimento custom)
- **Totale + per porzione** calcolati live
- Modifica/elimina ricette dal list

### Allenamento (`/allenamento`)

Il tracking della sala pesi, con quattro schede.

**Schede** — le tue routine, raggruppate per programma. Ogni scheda contiene gli esercizi con serie, range di ripetizioni, RPE target e recupero. Mentre la costruisci vedi in tempo reale quante serie stai assegnando a ogni gruppo muscolare: è il modo più rapido per accorgerti di uno squilibrio prima di allenarti. Da qui parti con "Inizia".

**Allenamento in corso** — il logger. Per ogni esercizio hai la colonna *Precedente* con quello che avevi fatto l'ultima volta (tap per copiarlo), i campi kg e ripetizioni, e la spunta che chiude la serie e fa partire il timer di recupero. Puoi marcare le serie come riscaldamento, drop set, a cedimento o back-off; il riscaldamento non conta nel volume. Alla chiusura la sessione calcola i record personali e crea da sola la voce corrispondente in Recupero, così il bilancio calorico resta allineato.

**Storico** — tutte le sedute completate, espandibili per rivedere serie e carichi, con il badge sui record.

**Statistiche** — serie settimanali per gruppo muscolare confrontate col riferimento 10-20, andamento del volume, e i massimali stimati per esercizio con la curva di progressione.

**Coach AI** — quattro azioni: fa il punto sulle ultime 6 settimane, analizza una scheda, prepara la seduta successiva proponendo i carichi sulla base del tuo storico, oppure genera un programma completo da una richiesta in linguaggio naturale ("4 giorni, ipertrofia, un'ora a seduta"). Il programma generato può essere salvato come schede vere con un tap.

### Recupero (`/training`)

3 sezioni stacked:

**Attività generiche**: quick-form (tipo, durata, intensità low/moderate/high, kcal opzionali, note) per cardio, corsa, sport. Le sedute di pesi si registrano in Allenamento e compaiono qui automaticamente.

**Sonno**: un'entry per notte (data = risveglio).
 Quality da 1 a 5. Bedtime/wake time opzionali. Se sovrascrivi la stessa data, fai upsert. Mostra media settimanale.

**Integratori**: due livelli.
- **Catalogo**: aggiungi gli integratori ricorrenti una volta (es. "Creatina 5g", "Vit D 2000 UI")
- **Log giornaliero**: tap "Logga oggi" su ogni card → segnato come preso. Lista di oggi qui sotto, con timestamp.

### Chat AI (`/chat`)

Il companion conversazionale. Ogni messaggio, l'AI vede **automaticamente**:
- Profilo, misure, obiettivo, target giornalieri
- Pasti di oggi con totali e residui
- Ultimi 7 giorni di pasti (con conteggi per categoria: carne/pesce/uova/latticini/legumi/frutta)
- Piano alimentare attivo
- Regole alimentari attive
- Correzioni apprese
- Ultimi 7 giorni di allenamenti e sonno
- Knowledge base (top-3 chunks rilevanti via RAG, se hai caricato documenti)
- System prompt attivo (tuo)

**Cose che funzionano bene**:
- "Cosa mangio a cena stasera?"
- "Analizza la giornata"
- "Come sto andando rispetto al target questa settimana?"
- "Dammi 3 spuntini sotto le 200 kcal che entrano nel mio piano"
- "Sostituisci il pollo di oggi con qualcosa di diverso — l'ho già mangiato 2 volte"
- "Come va il sonno ultimamente?" (se tracci il sonno)

**Ricorda**: bottone in alto a destra, apre un dialog con 2 tab:
- **Correzione**: salva una nota trasversale (es. "non suggerire mai pollo 3 giorni di fila")
- **Regola alimentare**: aggiunge una regola (es. "max 3× pesce a settimana")

Entrambe vengono iniettate nel contesto di tutte le chat successive.

**Pulisci**: cancella tutta la conversazione. I dati tracciati (pasti, misure, ecc.) restano.

### Revisione (`/reviews`)

Analisi bisettimanale AI-driven.

- **Genera review** → l'AI analizza gli ultimi 14 giorni:
  - Aderenza ai target (% giorni entro ±10%)
  - Trend peso vs obiettivo (cut = -0.5-1%/sett, bulk = +0.25-0.5%/sett)
  - Rating: buona/discreta/scarsa
- **Status**: on_track, adjust_needed, insufficient_data
- Se `adjust_needed`: **target proposti** con delta vs attuali e **reasoning markdown** che spiega il perché
- **Applica** → sovrascrive target in profile (un click), marca la review come applicata
- **Rifiuta** → archivia la review, target invariati
- **Storico** review sotto, dispiegabile

Banner sulla Home quando:
- Ultima review > 14 giorni fa + hai target e goal impostati (blanda, neutra)
- Revisione recente con `adjust_needed` non ancora applicata/rifiutata (amber, urgente)

### Impostazioni (`/settings`)

Pagina scrollable con molte sezioni:

- **Profilo**: sesso, nascita, altezza, attività
- **Obiettivo**: fase + peso/BF target + deadline
- **Target macro giornalieri**: kcal/P/C/G manuali o "Calcola automaticamente" (Mifflin-St Jeor × attività × fase)
- **Misure**: grafico peso, storico, add form (con o senza circonferenze)
- **Regole alimentari**: CRUD
- **Piano alimentare**: slot per pasto (vedi sopra)
- **AI & modelli**: provider attivo, key, modello, budget
- **System prompt**: editor versionato (default pre-caricato con principi cut/bulk/recomp)
- **Correzioni apprese**: CRUD
- **Knowledge base**: upload documenti markdown → embedding + RAG
- **Esporta dati**: JSON completo di tutto (17 tabelle)
- **Zona pericolosa**: reset completo con typing-confirm

---

## Flusso giornaliero consigliato

**Mattina (1 minuto)**
- Entra su Oggi → guardi kcal/macro attuali = 0
- Se hai tracciato il sonno: vai su Training → Sonno → entry per oggi

**Ogni pasto (30 secondi)**
- Pasti → FAB "+"
- Scegli la modalità più rapida:
  - Prodotto packaged → **Codice a barre**
  - Pasto complesso → **AI chat** ("pranzo: pollo 200g, riso 150g, verdure")
  - Alimento già salvato → **Cerca**
  - Porzione rapida → **Rapido**

**Post-allenamento (30 secondi)**
- Training → Allenamenti → add entry

**Prima di cena (1 minuto, opzionale ma potente)**
- Chat AI → "Cosa mangio a cena? Cosa mi manca?"
- L'AI ti dice kcal/macro residui + ti suggerisce combinazioni dal tuo piano alimentare

**Prima di dormire (opzionale)**
- Integratori → tap su quelli presi oggi se non l'hai già fatto

---

## Flusso settimanale

**Domenica mattina (5 minuti)**
- **Pesati** e aggiungi misura in Impostazioni → Misure
- (Opz.) prendi qualche circonferenza (vita, petto) ogni 2-4 settimane
- Guarda il **grafico peso** per vedere l'andamento

**Domenica sera / lunedì mattina (10 minuti)**
- Se è passata una review: Home ti mostra il banner → apri /reviews → Genera review
- Leggi il reasoning AI e decidi se applicare i nuovi target o rifiutare
- Se `on_track`: continua così
- Se `insufficient_data`: logga di più questa settimana

**Ogni 4-8 settimane**
- Valuta se cambiare fase in Impostazioni → Obiettivo (es. da cut a maintain)
- Aggiorna il peso target o la deadline se serve

---

## Come sfruttare l'AI al meglio

### 1. System prompt personalizzato
Il default è buono ma non sa chi sei esattamente. In Impostazioni → System prompt, aggiungi:
- Preferenze dietetiche (vegetariano, onnivoro, ecc.)
- Contesto personale (es. "sono un ingegnere che lavora al PC 8h/giorno, tendo a stare seduto")
- Stile di risposta che vuoi ("diretto, senza disclaimer medici")

### 2. Piano alimentare dettagliato
Più slot + alternative inserisci, meglio l'AI suggerisce. Se vuoi che ti proponga "colazione", serve che le alternative siano lì.

### 3. Correzioni via chat
Ogni volta che l'AI sbaglia qualcosa (stime macro, suggerimento assurdo, ripetizione), usa **Ricorda** per fissare la correzione. Si accumulano nel tempo.

### 4. Knowledge base
Carica guide/studi/articoli che vuoi che l'AI segua. Esempi utili:
- Guide di nutrizione che ti piacciono (Nippard, Jisel, ecc.)
- Paper scientifici specifici
- I tuoi appunti/regole personali più articolati
- Piani alimentari completi dettagliati di un nutrizionista

L'AI pesca i passaggi rilevanti automaticamente quando parli di temi affini.

Oltre ai documenti che carichi tu, l'AI ha già dentro i principi di **Project Nutrition** (Biasci) per la nutrizione e **Project Exercise** (Roncari) per biomeccanica e programmazione: reset metabolico, bilancio settimanale, ricariche, volume 10-20 serie per gruppo muscolare, bilanciamento dei pattern, miti da palestra smontati. Vengono attivati per argomento, quindi non appesantiscono ogni messaggio.

### 5. I rilievi automatici
Prima di rispondere, l'app calcola da sola alcune conclusioni sui tuoi dati — kcal/kg, aderenza reale ai target, velocità di variazione del peso, serie settimanali per gruppo muscolare, squilibri spinta/trazione, esercizi in stallo — e le passa all'AI come fatti già verificati. Significa due cose: i numeri nelle risposte non sono stimati a occhio, e se un rilievo è un blocco (per esempio "stai già sotto la soglia di kcal/kg, non è il momento di tagliare") l'AI non ti asseconderà se chiedi il contrario.

### 6. Revisioni consistenti
Genera review ogni 14 giorni. Da questa versione la review legge anche l'allenamento: distingue uno stallo da deficit sbagliato da uno stallo da stimolo insufficiente, cosa che con i soli dati alimentari non era possibile. L'AI migliora i suggerimenti nel tempo quando vede la storia delle review applicate.

---

## Costi AI e budget

Il budget mensile (Impostazioni → AI & modelli) blocca tutte le call AI quando viene superato. Stime indicative con modelli economici:

| Azione | Costo tipico (gpt-4o-mini) |
|---|---|
| Log pasto via AI chat | ~0.015¢ / call |
| Risposta chat companion | ~0.07¢ / call |
| Revisione bisettimanale | ~0.14¢ / call |
| Indicizzazione documento 10k caratteri | ~0.02¢ |
| Retrieval per chat (se hai doc) | ~0.001¢ / call |

Con un uso normale (30 chat + 50 meal log + 2 review al mese), sei sotto il **cent di spesa mensile**. Con `gemini-2.0-flash` ancora meno.

Il budget è in USD. 1$ / mese è abbondante per qualsiasi uso personale.

---

## Troubleshooting

**La chat risponde "sto pensando…" e non arriva mai la risposta**
- Il timeout client è 60s. Se Netlify (free tier = 10s) uccide il processo, dovresti vedere un toast di errore entro 10-15s.
- Se il toast non appare, refresh della pagina. Il messaggio inviato resta salvato, solo la risposta manca. Reinvia più breve.
- Se succede spesso: accorcia il messaggio e/o cancella la conversazione (la history è inclusa nel prompt, ~20 messaggi = +1000 token = +latenza).

**OFF non trova un prodotto**
- Dopo il banner "non trovato", clicca **"Aggiungi manualmente questo prodotto"**: inserisci nome + macro/100g una volta e la prossima scansione dello stesso barcode lo trova istantaneo.

**"Nessun provider AI attivo"**
- Vai in Impostazioni → AI & modelli, configura almeno una key OpenAI o Gemini.

**La key OpenAI non convalida**
- Verifica su https://platform.openai.com/api-keys che la key sia attiva e abbia credito/plan abilitato.

**Il barcode scanner è nero**
- Concedi i permessi camera nel browser.
- Richiede HTTPS (su Netlify funziona; su `localhost` funziona; su IP LAN **non** funziona).

**Ho cambiato target ma la Home non aggiorna**
- Forza refresh (Cmd/Ctrl+Shift+R) per invalidare il service worker PWA.

**Voglio ricominciare**
- Impostazioni → Zona pericolosa → "Ricomincia da capo" → type "RICOMINCIA" → cancella tutti i dati e ti riporta al wizard.

**Voglio un backup**
- Impostazioni → Esporta dati → scarica un JSON con 17 tabelle. Tienilo al sicuro.

---

## Struttura e architettura (per nerd)

- **Frontend**: React 18 + Vite + TypeScript, Tailwind + shadcn-style primitives, TanStack Query per data fetching, React Router 7. PWA via `vite-plugin-pwa`.
- **Auth & DB**: Supabase (Postgres + RLS + pgvector per RAG). Lo schema è 9 migrations in `supabase/migrations/`.
- **Backend**: Netlify Functions (Node 20) per le chiamate AI (API keys cifrate server-side con AES-256-GCM). Endpoint:
  - `/api/ai-list-models` · `/api/ai-save-key` · `/api/ai-delete-key`
  - `/api/ai-parse-meal` (Fase 5)
  - `/api/ai-chat` (Fase 6)
  - `/api/ai-phase-review` (Fase 9)
  - `/api/ai-embed-doc` (Fase 7)
  - `/api/reset-account` (Fase 10)
- **AI providers**: OpenAI + Gemini via wrapper unificato (`_lib/ai-call.ts`). Budget mensile enforced (`_lib/budget.ts`), cost tracking per model in `ai_usage_daily`.
- **Encryption**: master key 32 byte in env Netlify (`MASTER_ENCRYPTION_KEY`, 64-char hex). Le API key utente vengono cifrate AES-256-GCM; il client non ha mai la chiave in chiaro.

---

Ultimo aggiornamento: questa guida copre tutte le funzionalità al momento del commit di questo file. Se trovi comportamenti non documentati, probabilmente sono bug — segnalami.
