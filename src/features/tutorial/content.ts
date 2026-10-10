// Contenuti del tutorial e delle spiegazioni di sezione.
// Sorgente unica: lo stesso testo alimenta il tour guidato al primo
// accesso e il pulsante "?" nell'intestazione di ogni pagina.

import {
  BarChart3,
  Camera,
  ChefHat,
  Dumbbell,
  Home,
  LineChart,
  MessageCircle,
  Moon,
  Settings,
  Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SectionId =
  | 'home'
  | 'meals'
  | 'recipes'
  | 'workout'
  | 'recovery'
  | 'chat'
  | 'trends'
  | 'progress'
  | 'reviews'
  | 'settings'

export type SectionInfo = {
  id: SectionId
  label: string
  path: string
  icon: LucideIcon
  /** Una riga: cosa fa questa sezione. */
  summary: string
  /** Cosa ci fai davvero, in pratica. */
  bullets: string[]
  /** Il consiglio che non è ovvio dalla UI. */
  tip?: string
}

export const SECTIONS: SectionInfo[] = [
  {
    id: 'home',
    label: 'Oggi',
    path: '/',
    icon: Home,
    summary:
      'La dashboard del giorno: quanto hai mangiato, quanto ti manca al target, il peso e cosa hai fatto in palestra.',
    bullets: [
      'Le quattro card in alto mostrano calorie e macro consumati rispetto al target, con quanto resta da coprire.',
      'Le frecce accanto al titolo cambiano giorno: puoi rivedere ieri o preparare domani senza uscire dalla pagina.',
      'Da qui pesi rapidamente e logghi gli integratori con un tap.',
    ],
    tip: 'Se compare un banner di review, sono passate due settimane dall’ultima analisi: è il momento di leggerla.',
  },
  {
    id: 'meals',
    label: 'Pasti',
    path: '/meals',
    icon: Utensils,
    summary: 'Il diario alimentare, diviso in colazione, pranzo, cena e spuntini.',
    bullets: [
      'Il modo più veloce è la scheda **AI**: scrivi "150g di petto di pollo e due uova" e l’app calcola i macro, che puoi correggere prima di salvare.',
      'In alternativa cerchi un alimento, scansioni un codice a barre, inserisci i macro a mano o richiami una tua ricetta.',
      'I pesi si intendono sempre **da crudo**, se non scrivi esplicitamente "cotto".',
    ],
    tip: 'Se l’AI sbaglia una stima, correggila e usa "Ricorda" in chat: da lì in poi terrà conto della correzione.',
  },
  {
    id: 'recipes',
    label: 'Ricette',
    path: '/recipes',
    icon: ChefHat,
    summary:
      'Le tue preparazioni ricorrenti, con i macro calcolati una volta sola.',
    bullets: [
      'Componi la ricetta con gli ingredienti e il numero di porzioni: l’app calcola i valori totali e per porzione.',
      'Poi la aggiungi ai pasti in un tap, senza ricalcolare ogni volta.',
    ],
    tip: 'Conviene crearle per i piatti che ripeti almeno una volta a settimana.',
  },
  {
    id: 'workout',
    label: 'Allenamento',
    path: '/allenamento',
    icon: Dumbbell,
    summary:
      'La sala pesi: schede, registrazione delle serie, statistiche e coach AI.',
    bullets: [
      '**Schede**: costruisci le routine con serie, ripetizioni, RPE e recuperi. Mentre le componi vedi quante serie stai assegnando a ogni gruppo muscolare.',
      '**Allenamento in corso**: durante la seduta hai la colonna "Precedente" con quello che avevi fatto l’ultima volta, la spunta che chiude la serie e avvia il timer di recupero, e i tipi di serie (riscaldamento, drop, cedimento).',
      '**Statistiche**: serie settimanali per gruppo muscolare rispetto al riferimento 10-20, andamento del volume e massimali stimati.',
      '**Coach AI**: analizza una scheda, prepara la seduta successiva coi carichi, o genera un programma completo da una richiesta a parole.',
    ],
    tip: 'Chiudendo la seduta l’app calcola da sola i record e crea la voce corrispondente in Recupero: il bilancio calorico resta allineato senza registrare due volte.',
  },
  {
    id: 'recovery',
    label: 'Recupero',
    path: '/training',
    icon: Moon,
    summary:
      'Tutto quello che non è sala pesi: cardio e sport, sonno, integratori.',
    bullets: [
      'Le attività generiche (corsa, nuoto, camminata) si registrano qui con durata e intensità, e l’AI può stimarne le calorie.',
      'Il sonno si registra una volta per notte, con ore e qualità.',
      'Gli integratori si definiscono una volta nel catalogo e poi si loggano con un tap.',
    ],
    tip: 'Sonno e stress contano quanto la dieta: se il peso non si muove, l’AI guarda anche qui prima di proporti di tagliare.',
  },
  {
    id: 'chat',
    label: 'Chat AI',
    path: '/chat',
    icon: MessageCircle,
    summary: 'Il coach con cui parli. Vede i tuoi dati reali, non risponde a caso.',
    bullets: [
      'Conosce profilo, obiettivo, pasti del giorno e della settimana, allenamenti con il volume per gruppo muscolare, sonno, regole alimentari e i documenti che hai caricato.',
      'Prima di rispondere l’app calcola alcuni indicatori (kcal per kg, aderenza reale, serie settimanali, squilibri, stalli) e glieli passa già verificati.',
      'Ragiona seguendo *Project Nutrition* per la nutrizione e *Project Exercise* per la biomeccanica.',
    ],
    tip: 'Se ti dice che non è il momento di tagliare le calorie, non è prudenza generica: è una soglia calcolata sui tuoi numeri.',
  },
  {
    id: 'trends',
    label: 'Andamento',
    path: '/andamento',
    icon: LineChart,
    summary: 'Come si muovono peso e massa grassa nel tempo.',
    bullets: [
      'Il grafico del peso mostra anche la media mobile: è quella che conta, non il dato di stamattina.',
      'Puoi confrontare le variazioni su 7, 30 e 90 giorni.',
    ],
    tip: 'Pesati sempre nelle stesse condizioni. Le oscillazioni giornaliere sono acqua, non grasso.',
  },
  {
    id: 'progress',
    label: 'Progresso',
    path: '/progresso',
    icon: Camera,
    summary: 'Le foto dei progressi, con analisi AI opzionale.',
    bullets: [
      'Carichi fronte, retro e lato in una sessione; le foto restano private nel tuo spazio.',
      'L’AI può stimare la massa grassa dalle immagini e commentare i punti forti e deboli.',
    ],
    tip: 'Stessa luce, stessa posa, stessa ora del giorno: senza questo il confronto non dice nulla.',
  },
  {
    id: 'reviews',
    label: 'Revisione',
    path: '/reviews',
    icon: BarChart3,
    summary:
      'L’analisi che ogni due settimane dice se il piano sta funzionando.',
    bullets: [
      'Confronta calorie e macro reali, aderenza, variazione di peso e allenamento svolto.',
      'Se serve, propone nuovi target che puoi applicare con un tap o rifiutare.',
    ],
    tip: 'Con meno di sette giorni tracciati non propone modifiche: senza dati sarebbe un atto di fede.',
  },
  {
    id: 'settings',
    label: 'Impostazioni',
    path: '/settings',
    icon: Settings,
    summary: 'Profilo, obiettivo, target, configurazione AI e knowledge base.',
    bullets: [
      'Qui imposti la chiave API del provider AI: viene cifrata prima di essere salvata e puoi definire un tetto di spesa mensile.',
      'Il **system prompt** decide il carattere del coach; quello proposto contiene già i principi dei due libri di riferimento.',
      'Nella **knowledge base** carichi guide o piani che vuoi che l’AI segua: ne pesca i passaggi pertinenti quando servono.',
    ],
    tip: 'Da qui puoi anche esportare tutti i tuoi dati in JSON e rivedere questo tutorial.',
  },
]

export function getSection(id: SectionId): SectionInfo {
  const s = SECTIONS.find((x) => x.id === id)
  if (!s) throw new Error(`Sezione sconosciuta: ${id}`)
  return s
}

// --------------------------------------------------------------
// Passi del tour guidato
// --------------------------------------------------------------

export type TutorialStep =
  | { kind: 'intro' }
  | { kind: 'setup' }
  | { kind: 'section'; id: SectionId }
  | { kind: 'outro' }

export const TUTORIAL_STEPS: TutorialStep[] = [
  { kind: 'intro' },
  { kind: 'setup' },
  { kind: 'section', id: 'home' },
  { kind: 'section', id: 'meals' },
  { kind: 'section', id: 'workout' },
  { kind: 'section', id: 'chat' },
  { kind: 'section', id: 'trends' },
  { kind: 'section', id: 'reviews' },
  { kind: 'section', id: 'settings' },
  { kind: 'outro' },
]
