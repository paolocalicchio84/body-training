import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { currentMonthId, formatDateLong, formatMonthTitle, isMonthId } from '../dates.ts'
import { formatEuro } from '../money.ts'
import { PEOPLE, PERSON_IDS } from '../model.ts'
import { useMonthData, useStore } from '../store.tsx'
import { EuroValue, MonthChooser, useTitle } from '../ui.tsx'

function creditLabel(cents: number | null): string {
  if (cents === null) return 'Saldo'
  if (cents > 0) return 'A credito'
  if (cents < 0) return 'A debito'
  return 'In pari'
}

export function Home() {
  const { monthId = '' } = useParams()
  const navigate = useNavigate()
  const { openMonth, categories } = useStore()
  const [monthOpen, setMonthOpen] = useState(false)
  const month = useMonthData(monthId)
  const title = formatMonthTitle(monthId)
  useTitle(title)

  if (!isMonthId(monthId)) return <Navigate to="/" replace />

  if (!month.open) {
    return (
      <div className="stack home">
        <p className="home-month">{title}</p>
        <h1 className="home-debt">Mese vuoto.</h1>
        <button type="button" className="text-link" onClick={() => void openMonth(monthId)}>
          Apri {title}
        </button>
        {monthId === currentMonthId() ? null : (
          <section className="stack">
            <h2>Oppure un altro mese</h2>
            <MonthChooser
              onChoose={async (next) => {
                await openMonth(next)
                navigate(`/mese/${next}`)
              }}
            />
          </section>
        )}
      </div>
    )
  }

  const { computation } = month
  const missing = PERSON_IDS.filter((personId) => !computation.people[personId].saved)

  const tone = !computation.calculable ? 'blocked' : computation.openDebtCents === 0 ? 'even' : 'debt'
  const statement =
    missing.length === 0
      ? computation.phrase.replace(/ €/g, '\u00a0€')
      : missing.length === 2
        ? 'Inserisci i redditi'
        : `Manca il reddito di ${PEOPLE[missing[0]].name}`

  return (
    <div className="stack home">
      <p className="home-month">{title}</p>
      {missing.length === 2 ? (
        <Link className="button secondary" to={`/mese/${monthId}/redditi`}>
          Inserisci i redditi
        </Link>
      ) : missing.length > 0 ? (
        <h1 className="home-debt">
          <Link to={`/mese/${monthId}/redditi`}>{statement}</Link>
        </h1>
      ) : (
        <h1 className={`home-debt ${tone}`}>{statement}</h1>
      )}

      {computation.reason === 'no-positive-weight' ? (
        <p className="hint">Con questi netti non si può dividere.</p>
      ) : null}

      <div className="pair">
        {PERSON_IDS.map((personId) => {
          const person = computation.people[personId]
          return (
            <article className={`person ${personId}`} key={personId}>
              <h2>{PEOPLE[personId].name}</h2>
              <p className="kicker">{creditLabel(person.balanceCents)}</p>
              <p className="glance">
                <EuroValue cents={person.balanceCents} />
              </p>
              {person.saved ? null : <p className="missing">Manca il reddito</p>}
              <p className="meta">Pagato {formatEuro(person.paidCents)}</p>
            </article>
          )
        })}
      </div>

      {missing.length === 0 ? (
        <Link className="text-link" to={`/mese/${monthId}/saldo`}>
          Regola il saldo
        </Link>
      ) : null}

      <section className="stack">
        <div className="section-title">
          <h2>Spese</h2>
          {computation.totalExpensesCents > 0 ? (
            <span className="total">{formatEuro(computation.totalExpensesCents)}</span>
          ) : null}
        </div>
        {month.expenses.length === 0 ? <p className="muted">Nessuna spesa.</p> : null}
        {month.expenses.length > 0 ? (
          <div className="list">
            {month.expenses.map((expense) => {
              const category = categories.find((item) => item.id === expense.categoryId)
              return (
                <article className="expense" key={expense.id}>
                  <Link to={`/spesa/${expense.id}`}>
                    <strong>{category?.name ?? 'Categoria'}</strong>
                    <span className="amount">{formatEuro(expense.amountCents)}</span>
                    <span className="chev" aria-hidden="true">
                      ›
                    </span>
                    <p className="meta">
                      {formatDateLong(expense.date)} · {PEOPLE[expense.paidBy].name}
                      {expense.note ? ` · ${expense.note}` : ''}
                    </p>
                  </Link>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

      {monthOpen ? (
        <div className="month-sheet">
          <button type="button" className="more-open" aria-expanded="true" onClick={() => setMonthOpen(false)}>
            Passa a un altro mese
          </button>
          <MonthChooser
            onChoose={async (next) => {
              setMonthOpen(false)
              await openMonth(next)
              navigate(`/mese/${next}`)
            }}
          />
        </div>
      ) : (
        <button type="button" className="more-open" aria-expanded="false" onClick={() => setMonthOpen(true)}>
          Passa a un altro mese
        </button>
      )}
    </div>
  )
}
