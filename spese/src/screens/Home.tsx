import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { quotasForAmount } from '../calc.ts'
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
      <div className="stack">
        <div>
          <h1>{title}</h1>
          <p className="lede">Spese comuni divise in proporzione al reddito netto del mese.</p>
        </div>
        <Link className="button primary" to={`/mese/${monthId}/spesa/nuova`}>
          Inserisci una spesa
        </Link>
      </div>

      {missing.length > 0 ? (
        <section className="sheet stack">
          <p>
            {missing.length === 2
              ? 'Mancano i redditi di Paolo e di Cassiana.'
              : `Manca il reddito di ${PEOPLE[missing[0]].name}.`}{' '}
            Le spese già inserite restano in lista, senza quote.
          </p>
          <Link className="button secondary" to={`/mese/${monthId}/redditi`}>
            Compila i redditi
          </Link>
        </section>
      ) : null}

      {computation.reason === 'no-positive-weight' ? (
        <p className="hint">
          I redditi sono salvati, ma nessun peso è positivo. Un netto negativo resta visibile e non entra nel
          saldo.
        </p>
      ) : null}

      <Phrase computation={computation} />

      <p className="total">Totale spese {formatEuro(computation.totalExpensesCents)}</p>

      <div className="figures">
        {PERSON_IDS.map((personId) => {
          const person = computation.people[personId]
          return (
            <article className="person" key={personId}>
              <h2>{PEOPLE[personId].name}</h2>
              <dl>
                <dt>Reddito netto</dt>
                <dd>{person.saved ? formatEuro(person.netCents ?? 0) : 'Mancante'}</dd>
                <dt>Peso</dt>
                <dd>{person.saved ? formatEuro(person.weightCents ?? 0) : 'Mancante'}</dd>
                <dt>Pagato</dt>
                <dd>{formatEuro(person.paidCents)}</dd>
                <dt>Dovuto</dt>
                <dd>{person.owedCents === null ? '—' : formatEuro(person.owedCents)}</dd>
                <dt>Saldo</dt>
                <dd>
                  <EuroValue cents={person.balanceCents} />
                </dd>
              </dl>
            </article>
          )
        })}
      </div>

      <div className="row">
        <Link className="button secondary" to={`/mese/${monthId}/saldo`}>
          Saldo e regolamento
        </Link>
      </div>

      <section className="stack">
        <h2>Ultime spese</h2>
        {month.expenses.length === 0 ? <p className="muted">Nessuna spesa in questo mese.</p> : null}
        {month.expenses.map((expense) => {
          const category = categories.find((item) => item.id === expense.categoryId)
          const quotas = quotasForAmount(expense.amountCents, computation)
          return (
            <article className="expense" key={expense.id}>
              <Link to={`/spesa/${expense.id}`}>
                <div className="row spread">
                  <strong>{category?.name ?? 'Categoria'}</strong>
                  <span className="amount">{formatEuro(expense.amountCents)}</span>
                </div>
                <p className="meta">
                  {formatDateLong(expense.date)} · pagata da {PEOPLE[expense.paidBy].name}
                  {expense.note ? ` · ${expense.note}` : ''}
                </p>
                <p className="meta">
                  {quotas
                    ? `Paolo ${formatEuro(quotas.paolo)} · Cassiana ${formatEuro(quotas.cassiana)}`
                    : 'Quota non calcolabile'}
                </p>
              </Link>
            </article>
          )
        })}
      </section>

      <details className="sheet">
        <summary>Scegli un mese</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <MonthChooser
            onChoose={async (next) => {
              await openMonth(next)
              navigate(`/mese/${next}`)
            }}
          />
        </div>
      </details>
    </div>
  )
}
