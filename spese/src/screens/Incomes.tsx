import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
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
      setMessage(missing.length === 0 ? 'Salvato.' : `Manca ancora ${missing.join(' e ')}.`)
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <h1>Redditi</h1>
        <p className="meta">{title}</p>
      </div>
      <div className="cols">
        {PERSON_IDS.map((personId) => {
          const read = reads[personId]
          const draft = drafts[personId]
          const unit = formatEuro(PEOPLE[personId].voucherUnitCents)
          return (
            <section className="person stack" key={personId}>
              <h2>{PEOPLE[personId].name}</h2>
              <Field label="Stipendio">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.salary}
                  onChange={(event) => update(personId, 'salary', event.target.value)}
                />
              </Field>
              <Field label="Buoni" hint={`${unit} l’uno${read.voucherCents === null ? '' : ` · ${formatEuro(read.voucherCents)}`}`}>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.vouchers}
                  onChange={(event) => update(personId, 'vouchers', event.target.value)}
                />
              </Field>
              <Field label="Note spese">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.notes}
                  onChange={(event) => update(personId, 'notes', event.target.value)}
                />
              </Field>
              <p className="stat">
                <span>Mutuo</span>
                <strong>{formatEuro(PEOPLE[personId].mortgageCents)}</strong>
              </p>
              <Field label="Extra">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.extra}
                  onChange={(event) => update(personId, 'extra', event.target.value)}
                />
              </Field>
              <p className="result">
                <span>Netto</span>
                <strong>
                  {read.salaryEmpty ? 'Mancante' : read.netCents === null ? '—' : formatEuro(read.netCents)}
                </strong>
              </p>
              {read.weightCents !== null && read.netCents !== null && read.weightCents !== read.netCents ? (
                <p className="meta">Peso {formatEuro(read.weightCents)}</p>
              ) : null}
            </section>
          )
        })}
      </div>

      {preview.calculable && preview.percents ? (
        <p className="meta">
          Paolo {formatPercentHundredths(preview.percents.paolo)} · Cassiana{' '}
          {formatPercentHundredths(preview.percents.cassiana)}
        </p>
      ) : null}

      <Errors messages={errors} />
      {message ? <p className="status" role="status">{message}</p> : null}
      <button className="primary" type="submit" disabled={pending}>
        Salva
      </button>
    </form>
  )
}
