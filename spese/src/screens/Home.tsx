import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { formatDateLong, formatMonthTitle, isMonthId } from '../dates.ts'
import { formatEuro } from '../money.ts'
import { PEOPLE, PERSON_IDS } from '../model.ts'
import { useMonthData, useStore } from '../store.tsx'
import { EuroValue, MonthChooser, OpenMonthCard, Phrase, useTitle } from '../ui.tsx'

export function Home() {
  const { monthId = '' } = useParams()
  const navigate = useNavigate()
  const { openMonth, categories } = useStore()
  const month = useMonthData(monthId)
  const title = formatMonthTitle(monthId)
  useTitle(title)

  if (!isMonthId(monthId)) return <Navigate to="/" replace />

  if (!month.open) {
    return (
      <div className="stack">
        <OpenMonthCard monthId={monthId} onOpen={() => openMonth(monthId)} />
        <section className="sheet stack">
          <h2>Scegli un mese</h2>
          <MonthChooser
            onChoose={async (next) => {
              await openMonth(next)
              navigate(`/mese/${next}`)
            }}
          />
        </section>
      </div>
    )
  }

  const { computation } = month
  const missing = PERSON_IDS.filter((personId) => !computation.people[personId].saved)

  return (
    <div className="stack">
      <h1>{title}</h1>

      {missing.length > 0 ? (
        <Link className="text-link" to={`/mese/${monthId}/redditi`}>
          {missing.length === 2 ? 'Inserisci i redditi' : `Manca il reddito di ${PEOPLE[missing[0]].name}`}
        </Link>
      ) : null}

      {computation.reason === 'no-positive-weight' ? <p className="hint">Nessun peso positivo.</p> : null}

      <Phrase computation={computation} />
      <p className="total">Spese {formatEuro(computation.totalExpensesCents)}</p>

      <div className="pair">
        {PERSON_IDS.map((personId) => {
          const person = computation.people[personId]
          return (
            <article className="person" key={personId}>
              <h2>{PEOPLE[personId].name}</h2>
              <p className="glance">
                <EuroValue cents={person.balanceCents} />
              </p>
              <p className="meta">Pagato {formatEuro(person.paidCents)}</p>
            </article>
          )
        })}
      </div>

      <Link className="text-link" to={`/mese/${monthId}/saldo`}>
        Regola il saldo
      </Link>

      <section className="stack">
        <h2>Spese</h2>
        {month.expenses.length === 0 ? <p className="muted">Nessuna spesa.</p> : null}
        {month.expenses.map((expense) => {
          const category = categories.find((item) => item.id === expense.categoryId)
          return (
            <article className="expense" key={expense.id}>
              <Link to={`/spesa/${expense.id}`}>
                <div className="row spread">
                  <strong>{category?.name ?? 'Categoria'}</strong>
                  <span className="amount">{formatEuro(expense.amountCents)}</span>
                </div>
                <p className="meta">
                  {formatDateLong(expense.date)} · {PEOPLE[expense.paidBy].name}
                  {expense.note ? ` · ${expense.note}` : ''}
                </p>
              </Link>
            </article>
          )
        })}
      </section>

      <details>
        <summary>Altro mese</summary>
        <MonthChooser
          onChoose={async (next) => {
            await openMonth(next)
            navigate(`/mese/${next}`)
          }}
        />
      </details>
    </div>
  )
}
