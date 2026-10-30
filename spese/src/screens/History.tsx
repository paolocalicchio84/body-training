import { Link, useNavigate } from 'react-router-dom'
import { computeMonth } from '../calc.ts'
import { formatEuro } from '../money.ts'
import { formatMonthTitle, isMonthId } from '../dates.ts'
import type { MonthComputation } from '../calc.ts'
import { useStore } from '../store.tsx'
import { MonthChooser, useTitle } from '../ui.tsx'

export function History() {
  const store = useStore()
  const navigate = useNavigate()
  useTitle('Storico')
  const monthIds = new Set<string>()
  for (const income of store.incomes) monthIds.add(income.monthId)
  for (const expense of store.expenses) monthIds.add(expense.monthId)
  const ordered = [...monthIds].filter(isMonthId).sort((a, b) => b.localeCompare(a))

  return (
    <div className="stack">
      <h1>Storico</h1>
      {ordered.length === 0 ? <p className="muted">Ancora nessun mese con spese o redditi.</p> : null}
      {ordered.length > 0 ? (
        <div className="list">
          {ordered.map((monthId) => {
            const computation = computationFor(store, monthId)
            return (
              <Link className="month-link" key={monthId} to={`/mese/${monthId}`}>
                <strong>{formatMonthTitle(monthId)}</strong>
                <span className="amount">{formatEuro(computation.totalExpensesCents)}</span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
                <p className={`meta ${badgeTone(computation)}`}>{statusLabel(computation)}</p>
              </Link>
            )
          })}
        </div>
      ) : null}
      <section className="stack">
        <h2>Apri un mese</h2>
        <MonthChooser
          onChoose={async (monthId) => {
            await store.openMonth(monthId)
            navigate(`/mese/${monthId}`)
          }}
        />
      </section>
      <p className="warning">Solo su questo telefono. Se cancelli i dati del browser, si perdono.</p>
    </div>
  )
}

function computationFor(
  store: ReturnType<typeof useStore>,
  monthId: string,
): MonthComputation {
  return computeMonth({
    incomes: {
      paolo: toInput(store.incomes.find((income) => income.monthId === monthId && income.personId === 'paolo')),
      cassiana: toInput(
        store.incomes.find((income) => income.monthId === monthId && income.personId === 'cassiana'),
      ),
    },
    expenses: store.expenses.filter((expense) => expense.monthId === monthId),
    settlements: store.settlements.filter((settlement) => settlement.monthId === monthId),
  })
}

function toInput(
  record:
    | {
        salaryCents: number
        voucherCount: number
        notesCents: number
        extraCents: number
      }
    | undefined,
) {
  if (!record) return null
  return {
    salaryCents: record.salaryCents,
    voucherCount: record.voucherCount,
    notesCents: record.notesCents,
    extraCents: record.extraCents,
  }
}

function statusLabel(computation: MonthComputation): string {
  if (computation.reason === 'missing-income') return 'Redditi mancanti'
  if (!computation.calculable || computation.openDebtCents === null) return 'Ripartizione non calcolabile'
  if (computation.openDebtCents === 0) return 'In pari'
  return `Da pareggiare · ${formatEuro(computation.openDebtCents)}`
}

function badgeTone(computation: MonthComputation): string {
  if (!computation.calculable) return 'warn'
  if (computation.openDebtCents === 0) return 'even'
  return 'debt'
}
