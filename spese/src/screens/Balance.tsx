import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { formatDateLong, formatMonthTitle, isMonthId, isValidDate, todayIso } from '../dates.ts'
import { formatAmountInput, formatEuro, parseMoneyToCents } from '../money.ts'
import { PEOPLE, PERSON_IDS, createId, type PersonId, type Settlement } from '../model.ts'
import { useMonthData, useStore } from '../store.tsx'
import { Confirming, Errors, EuroValue, Field, OpenMonthCard, Phrase, useTitle } from '../ui.tsx'

export function Balance() {
  const { monthId = '' } = useParams()
  const { openMonth, removeSettlement } = useStore()
  const month = useMonthData(monthId)
  const title = formatMonthTitle(monthId)
  useTitle(`Saldo ${title}`)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (!isMonthId(monthId)) return <Navigate to="/" replace />
  if (!month.open) return <OpenMonthCard monthId={monthId} onOpen={() => openMonth(monthId)} />

  const { computation } = month

  return (
    <div className="stack">
      <div className="month-head">
        <h1>Saldo</h1>
        <p>{title}</p>
      </div>
      {computation.reason === 'missing-income' ? (
        <Link className="banner" to={`/mese/${monthId}/redditi`}>
          Inserisci i redditi di questo mese.
        </Link>
      ) : (
        <Phrase computation={computation} />
      )}
      {computation.reason === 'no-positive-weight' ? (
        <p className="hint">Con questi netti non si può dividere.</p>
      ) : null}
      {computation.calculable && computation.openDebtCents && computation.debtor && computation.creditor ? (
        <NewSettlement
          monthId={monthId}
          amountCents={computation.openDebtCents}
          from={computation.debtor}
          to={computation.creditor}
        />
      ) : null}
      <div className="figures">
        {PERSON_IDS.map((personId) => {
          const person = computation.people[personId]
          return (
            <article className={`person panel ${personId}`} key={personId}>
              <h2>{PEOPLE[personId].name}</h2>
              <p className="glance">
                <EuroValue cents={person.balanceCents} />
              </p>
              <dl>
                <dt>Pagato</dt>
                <dd>{formatEuro(person.paidCents)}</dd>
                <dt>Dovuto</dt>
                <dd>{person.owedCents === null ? '—' : formatEuro(person.owedCents)}</dd>
                <dt>Versato</dt>
                <dd>{formatEuro(person.sentCents)}</dd>
                <dt>Ricevuto</dt>
                <dd>{formatEuro(person.receivedCents)}</dd>
              </dl>
            </article>
          )
        })}
      </div>

      <section className="stack">
        <h2>Versamenti</h2>
        {month.settlements.length === 0 ? <p className="muted">Nessun versamento.</p> : null}
        {month.settlements.map((settlement) =>
          editingId === settlement.id ? (
            <SettlementEditor key={settlement.id} settlement={settlement} onClose={() => setEditingId(null)} />
          ) : (
            <article className="settlement" key={settlement.id}>
              <div className="row spread">
                <strong>
                  {PEOPLE[settlement.from].name} → {PEOPLE[settlement.to].name}
                </strong>
                <span className="amount">{formatEuro(settlement.amountCents)}</span>
              </div>
              <p className="meta">
                {formatDateLong(settlement.date)}
                {settlement.note ? ` · ${settlement.note}` : ''}
              </p>
              <div className="row">
                <button className="secondary" type="button" onClick={() => setEditingId(settlement.id)}>
                  Correggi
                </button>
                <Confirming
                  label="Annulla versamento"
                  confirmLabel="Annulla versamento"
                  question="Annullare questo versamento? Il debito corrispondente si riapre."
                  onConfirm={() => removeSettlement(settlement.id)}
                />
              </div>
            </article>
          ),
        )}
      </section>

    </div>
  )
}

function NewSettlement({
  monthId,
  amountCents,
  from,
  to,
}: {
  monthId: string
  amountCents: number
  from: PersonId
  to: PersonId
}) {
  const { saveSettlementRecord } = useStore()
  const [amount, setAmount] = useState(formatAmountInput(amountCents))
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const parsed = parseMoneyToCents(amount)

  useEffect(() => {
    setAmount(formatAmountInput(amountCents))
    setNote('')
    setErrors([])
  }, [monthId, amountCents, from, to])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validateSettlement(amount, date, from, to, note)
    if (nextErrors.length > 0 || parsed === null) {
      setErrors(nextErrors)
      return
    }
    setPending(true)
    try {
      await saveSettlementRecord({
        id: createId(),
        monthId,
        date,
        from,
        to,
        amountCents: parsed,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      })
      setNote('')
      setDate(todayIso())
    } catch {
      setErrors(['Non sono riuscito a salvare il versamento sul dispositivo.'])
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="panel stack settle" onSubmit={(event) => void onSubmit(event)}>
      <div>
        <h2>Versamento</h2>
        <p className="meta">
          Da {PEOPLE[from].name} a {PEOPLE[to].name}
        </p>
      </div>
      <Field label="Importo">
        <input inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      {parsed !== null && parsed > amountCents ? (
        <p className="hint">L’importo supera il debito aperto: dopo il versamento il saldo cambia segno.</p>
      ) : null}
      <Field label="Data">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <Field label="Nota">
        <input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Errors messages={errors} />
      <div className="settle-bar">
        <button className="primary" type="submit" disabled={pending}>
          Registra versamento
        </button>
      </div>
    </form>
  )
}

function SettlementEditor({ settlement, onClose }: { settlement: Settlement; onClose: () => void }) {
  const { saveSettlementRecord, removeSettlement } = useStore()
  const [amount, setAmount] = useState(formatAmountInput(settlement.amountCents))
  const [date, setDate] = useState(settlement.date)
  const [from, setFrom] = useState<PersonId>(settlement.from)
  const [to, setTo] = useState<PersonId>(settlement.to)
  const [note, setNote] = useState(settlement.note)
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validateSettlement(amount, date, from, to, note)
    const cents = parseMoneyToCents(amount)
    if (nextErrors.length > 0 || cents === null) {
      setErrors(nextErrors)
      return
    }
    setPending(true)
    try {
      await saveSettlementRecord({
        ...settlement,
        amountCents: cents,
        date,
        from,
        to,
        note: note.trim(),
      })
      onClose()
    } catch {
      setErrors(['Non sono riuscito a salvare la correzione.'])
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="settlement stack" onSubmit={(event) => void onSubmit(event)}>
      <h3>Correggi versamento</h3>
      <Field label="Importo">
        <input inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="Data">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <div className="split">
        <PersonSelect label="Da" value={from} onChange={setFrom} />
        <PersonSelect label="A" value={to} onChange={setTo} />
      </div>
      <Field label="Nota">
        <input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Errors messages={errors} />
      <div className="row">
        <button className="primary" type="submit" disabled={pending}>
          Salva modifiche
        </button>
        <button className="ghost" type="button" onClick={onClose}>
          Chiudi
        </button>
        <Confirming
          label="Annulla versamento"
          confirmLabel="Annulla versamento"
          question="Annullare questo versamento? Il debito corrispondente si riapre."
          onConfirm={async () => {
            await removeSettlement(settlement.id)
            onClose()
          }}
        />
      </div>
    </form>
  )
}

function PersonSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: PersonId
  onChange: (personId: PersonId) => void
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as PersonId)}>
        {PERSON_IDS.map((personId) => (
          <option key={personId} value={personId}>
            {PEOPLE[personId].name}
          </option>
        ))}
      </select>
    </label>
  )
}

function validateSettlement(amount: string, date: string, from: PersonId, to: PersonId, note: string): string[] {
  const errors: string[] = []
  const cents = parseMoneyToCents(amount)
  if (cents === null || cents < 1) {
    errors.push('Inserisci un importo maggiore di 0, con al massimo due decimali. Il minimo è 0,01 €.')
  }
  if (!isValidDate(date)) errors.push('Indica la data del versamento.')
  if (from === to) errors.push('Chi versa e chi riceve devono essere due persone diverse.')
  if (note.trim().length > 200) errors.push('La nota può avere al massimo 200 caratteri.')
  return errors
}
