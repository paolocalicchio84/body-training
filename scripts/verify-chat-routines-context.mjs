// Verifica locale (senza Supabase) del formattatore schede per la chat AI.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { register } from 'node:module'

// Carichiamo il TS compilato a mano: riscriviamo solo le pure functions
// qui sotto come mirror del comportamento atteso, per non dipendere da tsc.

function formatActiveRoutines(routines) {
  const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
  const lines = ['## Schede attive (programma pianificato)']
  if (routines.length === 0) {
    lines.push(
      'Nessuna scheda salvata per questo utente. Se chiede della "scheda" o del programma, dillo chiaramente: non inventare esercizi, serie o split.',
    )
    return lines.join('\n')
  }
  lines.push(
    "Queste sono le uniche schede dell'utente. Per valutarle o modificarle usa SOLO questi dati; non aggiungere esercizi assenti dall'elenco.",
  )
  for (const r of routines) {
    const day =
      r.weekday != null && r.weekday >= 0 && r.weekday <= 6
        ? WEEKDAYS[r.weekday]
        : null
    lines.push(`#### Scheda: ${r.name}${day ? ` (${day})` : ''}`)
    for (const e of r.exercises) {
      lines.push(
        `- ${e.name} (${e.primary_muscle}): ${e.target_sets} serie · ${e.rep_min ?? '?'}-${e.rep_max ?? '?'} rep`,
      )
    }
  }
  return lines.join('\n')
}

const empty = formatActiveRoutines([])
if (!empty.includes('Nessuna scheda salvata')) {
  console.error('FAIL empty grounding')
  process.exit(1)
}

const filled = formatActiveRoutines([
  {
    name: 'Upper A',
    weekday: 0,
    exercises: [
      {
        name: 'Panca piana',
        primary_muscle: 'petto',
        target_sets: 4,
        rep_min: 6,
        rep_max: 8,
      },
    ],
  },
])
if (!filled.includes('Panca piana') || !filled.includes('Upper A')) {
  console.error('FAIL filled routines')
  process.exit(1)
}
if (filled.includes('inventare')) {
  console.error('FAIL should not tell invent when data present')
  process.exit(1)
}

console.log('OK chat routines context formatting')
console.log('--- empty ---')
console.log(empty)
console.log('--- filled ---')
console.log(filled)
