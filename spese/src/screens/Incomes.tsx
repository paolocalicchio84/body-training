import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { computeMonth, readIncomeDraft, type IncomeDraft } from '../calc.ts'
import { formatMonthTitle, isMonthId } from '../dates.ts'
import { formatAmountInput, formatEuro, formatPercentHundredths } from '../money.ts'
import { PEOPLE, PERSON_IDS, type IncomeRecord, type PersonId } from '../model.ts'
import { useMonthData, useStore } from '../store.tsx'
import { Errors, Field, OpenMonthCard, useTitle } from '../ui.tsx'

const EMPTY_DRAFT: IncomeDraft = { salary: '', vouchers: '', notes: '', extra: '' }

function draftFrom(record: IncomeRecord | null): IncomeDraft {
  if (!record) return EMPTY_DRAFT
  return {
    salary: formatAmountInput(record.salaryCents),
    vouchers: String(record.voucherCount),
    notes: formatAmountInput(record.notesCents),
    extra: formatAmountInput(record.extraCents),
  }
}

export function Incomes() {
  const { monthId = '' } = useParams()
  const { openMonth, saveMonthIncomes } = useStore()
  const month = useMonthData(monthId)
  const title = formatMonthTitle(monthId)
  useTitle(`Redditi ${title}`)
  const signature = `${monthId}:${month.incomes.paolo?.salaryCents ?? 'x'}:${month.incomes.paolo?.voucherCount ?? 'x'}:${month.incomes.paolo?.notesCents ?? 'x'}:${month.incomes.paolo?.extraCents ?? 'x'}:${month.incomes.cassiana?.salaryCents ?? 'x'}:${month.incomes.cassiana?.voucherCount ?? 'x'}:${month.incomes.cassiana?.notesCents ?? 'x'}:${month.incomes.cassiana?.extraCents ?? 'x'}`
  const [drafts, setDrafts] = useState<Record<PersonId, IncomeDraft>>({
    paolo: draftFrom(month.incomes.paolo),
    cassiana: draftFrom(month.incomes.cassiana),
  })
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setDrafts({
      paolo: draftFrom(month.incomes.paolo),
      cassiana: draftFrom(month.incomes.cassiana),
    })
  }, [signature, month.incomes.paolo, month.incomes.cassiana])

  if (!isMonthId(monthId)) return <Navigate to="/" replace />
  if (!month.open) {
    return <OpenMonthCard monthId={monthId} onOpen={() => openMonth(monthId)} />
  }

  const reads = {
    paolo: readIncomeDraft('paolo', drafts.paolo),
    cassiana: readIncomeDraft('cassiana', drafts.cassiana),
  }
  const preview = computeMonth({
    incomes: { paolo: reads.paolo.income, cassiana: reads.cassiana.income },
    expenses: [],
    settlements: [],
  })

  function update(personId: PersonId, field: keyof IncomeDraft, value: string) {
    setMessage(null)
    setDrafts((current) => ({ ...current, [personId]: { ...current[personId], [field]: value } }))
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = [...reads.paolo.errors, ...reads.cassiana.errors]
    for (const personId of PERSON_IDS) {
      if (reads[personId].salaryEmpty && month.incomes[personId]) {
        nextErrors.push(`Lo stipendio di ${PEOPLE[personId].name} va confermato, anche se è 0.`)
      }
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      setMessage(null)
      return
    }
    const payload: Partial<Record<PersonId, NonNullable<(typeof reads)['paolo']['income']>>> = {}
    for (const personId of PERSON_IDS) {
      if (reads[personId].income) payload[personId] = reads[personId].income
    }
    if (!payload.paolo && !payload.cassiana) {
      setErrors(['Conferma lo stipendio di Paolo e di Cassiana. Può essere 0.'])
      setMessage(null)
      return
    }
    setPending(true)
    setErrors([])
    try {
      await saveMonthIncomes(monthId, payload)
      const missing = PERSON_IDS.filter((personId) => !payload[personId]).map((personId) => PEOPLE[personId].name)
      setMessage(
        missing.length === 0
          ? 'Redditi salvati. Le quote delle spese di questo mese sono aggiornate.'
          : `Reddito salvato. Manca ancora il reddito di ${missing.join(' e di ')}.`,
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <h1>Redditi</h1>
        <p className="lede">{title}. Il valore del buono è fisso: Paolo 4,50 €, Cassiana 10,00 €.</p>
      </div>
      <div className="cols">
        {PERSON_IDS.map((personId) => {
          const read = reads[personId]
          const draft = drafts[personId]
          return (
            <section className="person stack" key={personId}>
              <h2>{PEOPLE[personId].name}</h2>
              <Field label="Stipendio del mese" hint="Obbligatorio al salvataggio. Può essere 0.">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.salary}
                  onChange={(event) => update(personId, 'salary', event.target.value)}
                />
              </Field>
              <Field label="Numero di buoni pasto" hint="Intero, zero compreso. Vuoto al salvataggio vale 0.">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.vouchers}
                  onChange={(event) => update(personId, 'vouchers', event.target.value)}
                />
              </Field>
              <Field label="Valore unitario">
                <div className="readonly">{formatEuro(PEOPLE[personId].voucherUnitCents)}</div>
              </Field>
              <Field label="Valore buoni">
                <div className="readonly">{read.voucherCents === null ? '—' : formatEuro(read.voucherCents)}</div>
              </Field>
              <Field label="Note spese già presenti sullo stipendio" hint="Vuoto al salvataggio vale 0.">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.notes}
                  onChange={(event) => update(personId, 'notes', event.target.value)}
                />
              </Field>
              <Field label="Guadagni extra" hint="Vuoto al salvataggio vale 0.">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.extra}
                  onChange={(event) => update(personId, 'extra', event.target.value)}
                />
              </Field>
              <Field label="Reddito netto">
                <div className="readonly">
                  {read.salaryEmpty ? 'Mancante' : read.netCents === null ? '—' : formatEuro(read.netCents)}
                </div>
              </Field>
              <p className="meta">Peso {read.weightCents === null ? '—' : formatEuro(read.weightCents)}</p>
            </section>
          )
        })}
      </div>

      <section className="sheet">
        {preview.calculable && preview.weightSumCents !== null && preview.percents ? (
          <p>
            Somma dei pesi {formatEuro(preview.weightSumCents)}. Paolo{' '}
            {formatPercentHundredths(preview.percents.paolo)}. Cassiana{' '}
            {formatPercentHundredths(preview.percents.cassiana)}.
          </p>
        ) : (
          <p>Ripartizione non calcolabile finché non c’è almeno un peso positivo e i redditi di entrambi.</p>
        )}
      </section>

      <Errors messages={errors} />
      {message ? <p className="status" role="status">{message}</p> : null}
      <div className="row">
        <button className="primary" type="submit" disabled={pending}>
          Salva i redditi del mese
        </button>
        <Link className="button ghost" to={`/mese/${monthId}`}>
          Torna al mese
        </Link>
      </div>
    </form>
  )
}
