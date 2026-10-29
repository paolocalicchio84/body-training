import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { MONTH_NAMES, currentMonthId, formatMonthTitle, isMonthId } from './dates.ts'
import { formatEuro } from './money.ts'
import type { MonthComputation } from './calc.ts'

export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Spese di coppia`
  }, [title])
}

export function Errors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null
  return (
    <ul className="errors" role="alert">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}

export function Phrase({ computation }: { computation: MonthComputation }) {
  const tone = !computation.calculable ? 'blocked' : computation.openDebtCents === 0 ? 'even' : 'debt'
  return <p className={`phrase ${tone}`}>{computation.phrase}</p>
}

export function EuroValue({ cents }: { cents: number | null }) {
  if (cents === null) return <>—</>
  const tone = cents > 0 ? 'positive' : cents < 0 ? 'negative' : undefined
  return <span className={tone}>{cents > 0 ? `+ ${formatEuro(cents)}` : formatEuro(cents)}</span>
}

export function MonthChooser({
  submitLabel = 'Apri mese',
  onChoose,
}: {
  submitLabel?: string
  onChoose: (monthId: string) => void | Promise<void>
}) {
  const current = currentMonthId()
  const [month, setMonth] = useState(current.slice(5, 7))
  const [year, setYear] = useState(current.slice(0, 4))
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const monthId = `${year}-${month}`
    if (!isMonthId(monthId)) {
      setError('Scegli un anno tra il 1 e il 9999.')
      return
    }
    setError(null)
    void onChoose(monthId)
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="cols">
        <label>
          <span>Mese</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)}>
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, '0')}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Anno</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={year}
            onChange={(event) => setYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </label>
      </div>
      {error ? <Errors messages={[error]} /> : null}
      <button className="secondary" type="submit">
        {submitLabel}
      </button>
    </form>
  )
}

export function OpenMonthCard({
  monthId,
  onOpen,
}: {
  monthId: string
  onOpen: () => Promise<void>
}) {
  const title = formatMonthTitle(monthId)
  const [pending, setPending] = useState(false)
  return (
    <section className="sheet stack">
      <h1>{title}</h1>
      <p>
        {title} non è ancora aperto. Un mese nuovo nasce vuoto: stipendio, buoni, note spese ed extra non si
        copiano dal mese precedente. Categorie e valore dei buoni restano quelli già definiti.
      </p>
      <button
        className="primary"
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true)
          void onOpen().finally(() => setPending(false))
        }}
      >
        Apri {title}
      </button>
    </section>
  )
}

export function Confirming({
  label,
  question,
  confirmLabel,
  tone = 'danger',
  onConfirm,
}: {
  label: string
  question: string
  confirmLabel: string
  tone?: 'danger' | 'secondary'
  onConfirm: () => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  if (!open) {
    return (
      <button className={tone === 'danger' ? 'ghost' : 'secondary'} type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }
  return (
    <div className="confirm">
      <p>{question}</p>
      <div className="row">
        <button
          className={tone}
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true)
            void Promise.resolve(onConfirm()).finally(() => setPending(false))
          }}
        >
          {confirmLabel}
        </button>
        <button className="ghost" type="button" onClick={() => setOpen(false)}>
          Torna indietro
        </button>
      </div>
    </div>
  )
}

export function MonthField({ value, onChange }: { value: string; onChange: (monthId: string) => void }) {
  const safe = isMonthId(value) ? value : currentMonthId()
  const [yearPart, monthPart] = safe.split('-')
  const [yearText, setYearText] = useState(yearPart)

  useEffect(() => {
    setYearText(yearPart)
  }, [yearPart])

  return (
    <div className="cols">
      <label>
        <span>Mese</span>
        <select
          value={monthPart}
          onChange={(event) => onChange(`${yearText.length === 4 ? yearText : yearPart}-${event.target.value}`)}
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={String(index + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Anno</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={yearText}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, 4)
            setYearText(next)
            if (next.length === 4) onChange(`${next}-${monthPart}`)
          }}
        />
      </label>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small className="hint">{hint}</small> : null}
    </label>
  )
}
