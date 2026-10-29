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
      <div>
        <h1>Storico</h1>
        <p className="lede">Dal mese più recente. Un mese senza spese e senza redditi non compare.</p>
      </div>
      {ordered.length === 0 ? <p>Nessun mese con spese o redditi.</p> : null}
      {ordered.map((monthId) => {
        const computation = computationFor(store, monthId)
        return (
          <Link className="month-link" key={monthId} to={`/mese/${monthId}`}>
            <div className="row spread">
              <strong>{formatMonthTitle(monthId)}</strong>
              <span className={`badge ${badgeTone(computation)}`}>{statusLabel(computation)}</span>
            </div>
            <p className="meta">Totale spese {formatEuro(computation.totalExpensesCents)}</p>
            {computation.calculable && computation.openDebtCents ? (
              <p className="meta">{computation.phrase}</p>
            ) : null}
          </Link>
        )
      })}
      <section className="sheet stack">
        <h2>Apri un mese</h2>
        <MonthChooser
          onChoose={async (monthId) => {
            await store.openMonth(monthId)
            navigate(`/mese/${monthId}`)
          }}
        />
      </section>
      <p className="warning">
        I dati restano solo su questo dispositivo. Se cancelli i dati del browser o cambi telefono, questa bozza si
        perde. Non c’è una copia di sicurezza.
      </p>
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
