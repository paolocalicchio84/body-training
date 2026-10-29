import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { quotasForAmount } from '../calc.ts'
import { sortCategories } from '../db.ts'
import { isMonthId, isValidDate, monthIdFromDate, todayIso } from '../dates.ts'
import { formatAmountInput, formatEuro, parseMoneyToCents } from '../money.ts'
import { PEOPLE, PERSON_IDS, createId, type PersonId } from '../model.ts'
import { useMonthData, useStore } from '../store.tsx'
import { Confirming, Errors, Field, MonthField, useTitle } from '../ui.tsx'

export function ExpenseForm() {
  const { monthId: routeMonth = '', expenseId } = useParams()
  const navigate = useNavigate()
  const store = useStore()
  const expense = expenseId ? store.expenses.find((item) => item.id === expenseId) : undefined
  useTitle(expense ? 'Correggi spesa' : 'Nuova spesa')

  if (expenseId && !expense) {
    return (
      <section className="sheet stack">
        <h1>Spesa non trovata</h1>
        <Link className="button secondary" to={`/mese/${store.viewMonthId}`}>
          Torna al mese
        </Link>
      </section>
    )
  }
  if (!expenseId && !isMonthId(routeMonth)) return <Navigate to="/" replace />

  return (
    <ExpenseEditor
      key={expense?.id ?? `nuova-${routeMonth}`}
      originMonthId={expense?.monthId ?? routeMonth}
      expense={expense}
      profile={store.profile}
      onDone={(monthId) => navigate(`/mese/${monthId}`)}
    />
  )
}

function ExpenseEditor({
  originMonthId,
  expense,
  profile,
  onDone,
}: {
  originMonthId: string
  expense?: {
    id: string
    amountCents: number
    date: string
    paidBy: PersonId
    categoryId: string
    monthId: string
    note: string
    createdAt: string
  }
  profile: PersonId
  onDone: (monthId: string) => void
}) {
  const { categories, saveExpenseRecord, removeExpense } = useStore()
  const [amount, setAmount] = useState(expense ? formatAmountInput(expense.amountCents) : '')
  const [date, setDate] = useState(expense?.date ?? todayIso())
  const [paidBy, setPaidBy] = useState<PersonId>(expense?.paidBy ?? profile)
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [monthId, setMonthId] = useState(expense?.monthId ?? originMonthId)
  const [monthTouched, setMonthTouched] = useState(
    Boolean(expense && monthIdFromDate(expense.date) !== expense.monthId),
  )
  const [note, setNote] = useState(expense?.note ?? '')
  const [errors, setErrors] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const month = useMonthData(isMonthId(monthId) ? monthId : originMonthId)
  const parsed = parseMoneyToCents(amount)
  const quotas = parsed && parsed > 0 ? quotasForAmount(parsed, month.computation) : null
  const options = sortCategories(categories).filter((category) => !category.archived || category.id === categoryId)

  function onDate(value: string) {
    setDate(value)
    if (expense && !monthTouched) {
      const proposed = monthIdFromDate(value)
      if (proposed) setMonthId(proposed)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: string[] = []
    const cents = parseMoneyToCents(amount)
    if (cents === null || cents < 1) {
      nextErrors.push('Inserisci un importo maggiore di 0, con al massimo due decimali. Il minimo è 0,01 €.')
    }
    if (!isValidDate(date)) nextErrors.push('Indica il giorno in cui la spesa risulta pagata.')
    if (!categoryId) nextErrors.push('Scegli una categoria.')
    const category = categories.find((item) => item.id === categoryId)
    if (categoryId && !category) nextErrors.push('Scegli una categoria.')
    if (category?.archived && category.id !== expense?.categoryId) {
      nextErrors.push('Questa categoria è archiviata e non si usa per una spesa nuova.')
    }
    if (!PERSON_IDS.includes(paidBy)) nextErrors.push('Indica chi ha pagato.')
    if (!isMonthId(monthId)) nextErrors.push('Indica il mese di ripartizione.')
    if (note.trim().length > 200) nextErrors.push('La nota può avere al massimo 200 caratteri.')
    if (nextErrors.length > 0 || cents === null) {
      setErrors(nextErrors)
      return
    }
    setPending(true)
    setErrors([])
    const record = {
      id: expense?.id ?? createId(),
      amountCents: cents,
      date,
      paidBy,
      categoryId,
      monthId,
      note: note.trim(),
      createdAt: expense?.createdAt ?? new Date().toISOString(),
    }
    try {
      await saveExpenseRecord(record)
      onDone(record.monthId)
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <h1>{expense ? 'Correggi spesa' : 'Nuova spesa'}</h1>
      <Field label="Importo">
        <input inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="Data">
        <input type="date" value={date} onChange={(event) => onDate(event.target.value)} required />
      </Field>
      <Field label="Categoria">
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Scegli</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.archived ? ' (archiviata)' : ''}
            </option>
          ))}
        </select>
      </Field>
      {options.length === 0 ? (
        <p>
          Non ci sono categorie attive. <Link to="/categorie">Gestisci le categorie</Link>.
        </p>
      ) : null}
      <fieldset className="stack">
        <legend>Pagata da</legend>
        <div className="row">
          {PERSON_IDS.map((personId) => (
            <label key={personId} className="row">
              <input
                type="radio"
                name="paidBy"
                checked={paidBy === personId}
                onChange={() => setPaidBy(personId)}
              />
              {PEOPLE[personId].name}
            </label>
          ))}
        </div>
      </fieldset>
      {expense ? (
        <MonthField
          value={monthId}
          onChange={(next) => {
            setMonthTouched(true)
            setMonthId(next)
          }}
        />
      ) : null}
      <Field label="Nota">
        <textarea value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {quotas ? (
        <p className="meta">
          Paolo {formatEuro(quotas.paolo)} · Cassiana {formatEuro(quotas.cassiana)}
        </p>
      ) : null}
      <Errors messages={errors} />
      <div className="row">
        <button className="primary" type="submit" disabled={pending}>
          {expense ? 'Salva modifiche' : 'Salva la spesa'}
        </button>
        <Link className="button ghost" to={`/mese/${originMonthId}`}>
          Annulla
        </Link>
      </div>
      {expense ? (
        <Confirming
          label="Elimina spesa"
          confirmLabel="Elimina"
          question="Eliminare questa spesa? Il saldo del mese viene ricalcolato. Un versamento già registrato resta: se il saldo cambia segno, annullalo o riducilo."
          onConfirm={async () => {
            await removeExpense(expense.id)
            onDone(expense.monthId)
          }}
        />
      ) : null}
    </form>
  )
}

