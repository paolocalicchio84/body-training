import { formatEuro, parseMoneyToCents, parseVoucherCount } from './money.ts'
import { PEOPLE, type IncomeInput, type PersonId } from './model.ts'

export type IncomeDraft = {
  salary: string
  vouchers: string
  notes: string
  extra: string
}

export type DraftRead = {
  errors: string[]
  salaryEmpty: boolean
  income: IncomeInput | null
  voucherCents: number | null
  netCents: number | null
  weightCents: number | null
}

export function netIncomeCents(personId: PersonId, income: IncomeInput): number {
  return (
    income.salaryCents +
    income.voucherCount * PEOPLE[personId].voucherUnitCents -
    income.notesCents +
    income.extraCents
  )
}

/** Il peso di ripartizione non è mai negativo. Il netto negativo resta solo informativo. */
export function weightFromNet(netCents: number): number {
  return netCents > 0 ? netCents : 0
}

/** Arrotondamento commerciale: dal mezzo in su si sale. Solo numeri non negativi. */
export function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('Divisore non valido')
  if (numerator < 0n) throw new Error('Numeratore negativo')
  return (numerator + denominator / 2n) / denominator
}

/**
 * Quota di Cassiana arrotondata al centesimo, quota di Paolo per differenza.
 * La somma coincide sempre con l’importo.
 */
export function quotasCents(
  amountCents: number,
  weightPaolo: number,
  weightCassiana: number,
): { paolo: number; cassiana: number } {
  const sum = weightPaolo + weightCassiana
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error('Importo non valido')
  }
  if (sum <= 0) throw new Error('Ripartizione non calcolabile')
  const cassiana = Number(
    roundHalfUpDiv(BigInt(amountCents) * BigInt(weightCassiana), BigInt(sum)),
  )
  return { paolo: amountCents - cassiana, cassiana }
}

export function readIncomeDraft(personId: PersonId, draft: IncomeDraft): DraftRead {
  const name = PEOPLE[personId].name
  const errors: string[] = []
  const salaryEmpty = draft.salary.trim() === ''
  let salaryCents: number | null = null
  if (!salaryEmpty) {
    salaryCents = parseMoneyToCents(draft.salary)
    if (salaryCents === null) {
      errors.push(
        `Lo stipendio di ${name} non è valido. Usa zero o un importo positivo, con al massimo due decimali.`,
      )
    }
  }

  let voucherCount = 0
  let vouchersOk = true
  if (draft.vouchers.trim() === '') {
    voucherCount = 0
  } else {
    const parsed = parseVoucherCount(draft.vouchers)
    if (parsed === null) {
      vouchersOk = false
      errors.push(`Il numero di buoni di ${name} deve essere un intero maggiore o uguale a 0.`)
    } else {
      voucherCount = parsed
    }
  }

  const notesCents = readOptionalMoney(
    draft.notes,
    `Le note spese già sullo stipendio di ${name}`,
    errors,
  )
  const extraCents = readOptionalMoney(draft.extra, `I guadagni extra di ${name}`, errors)

  const voucherCents = vouchersOk ? voucherCount * PEOPLE[personId].voucherUnitCents : null
  let income: IncomeInput | null = null
  if (errors.length === 0 && salaryCents !== null && notesCents !== null && extraCents !== null && vouchersOk) {
    income = { salaryCents, voucherCount, notesCents, extraCents }
  }
  const netCents = income ? netIncomeCents(personId, income) : null
  return {
    errors,
    salaryEmpty,
    income,
    voucherCents,
    netCents,
    weightCents: netCents === null ? null : weightFromNet(netCents),
  }
}

function readOptionalMoney(raw: string, label: string, errors: string[]): number | null {
  if (raw.trim() === '') return 0
  const cents = parseMoneyToCents(raw)
  if (cents === null) {
    errors.push(`${label} non è un importo valido. Usa zero o un importo positivo, con al massimo due decimali.`)
    return null
  }
  return cents
}

export type PersonFigures = {
  saved: boolean
  netCents: number | null
  weightCents: number | null
  paidCents: number
  owedCents: number | null
  sentCents: number
  receivedCents: number
  balanceCents: number | null
}

export type MonthComputation = {
  calculable: boolean
  reason: 'ok' | 'missing-income' | 'no-positive-weight'
  totalExpensesCents: number
  weightSumCents: number | null
  /** Centinaia di punto percentuale: 5396 = 53,96 %. */
  percents: Record<PersonId, number> | null
  people: Record<PersonId, PersonFigures>
  phrase: string
  debtor: PersonId | null
  creditor: PersonId | null
  openDebtCents: number | null
}

export function computeMonth(input: {
  incomes: Record<PersonId, IncomeInput | null>
  expenses: { amountCents: number; paidBy: PersonId }[]
  settlements: { amountCents: number; from: PersonId; to: PersonId }[]
}): MonthComputation {
  const nets: Record<PersonId, number | null> = {
    paolo: input.incomes.paolo ? netIncomeCents('paolo', input.incomes.paolo) : null,
    cassiana: input.incomes.cassiana ? netIncomeCents('cassiana', input.incomes.cassiana) : null,
  }
  const weights: Record<PersonId, number | null> = {
    paolo: nets.paolo === null ? null : weightFromNet(nets.paolo),
    cassiana: nets.cassiana === null ? null : weightFromNet(nets.cassiana),
  }
  const missing = nets.paolo === null || nets.cassiana === null
  const weightSum = missing ? null : weights.paolo! + weights.cassiana!
  const calculable = weightSum !== null && weightSum > 0

  const paid: Record<PersonId, number> = { paolo: 0, cassiana: 0 }
  const owed: Record<PersonId, number> = { paolo: 0, cassiana: 0 }
  let totalExpensesCents = 0
  for (const expense of input.expenses) {
    totalExpensesCents += expense.amountCents
    paid[expense.paidBy] += expense.amountCents
    if (calculable) {
      const quota = quotasCents(expense.amountCents, weights.paolo!, weights.cassiana!)
      owed.paolo += quota.paolo
      owed.cassiana += quota.cassiana
    }
  }

  const sent: Record<PersonId, number> = { paolo: 0, cassiana: 0 }
  const received: Record<PersonId, number> = { paolo: 0, cassiana: 0 }
  for (const settlement of input.settlements) {
    sent[settlement.from] += settlement.amountCents
    received[settlement.to] += settlement.amountCents
  }

  const people = {
    paolo: figures('paolo'),
    cassiana: figures('cassiana'),
  }

  function figures(personId: PersonId): PersonFigures {
    return {
      saved: nets[personId] !== null,
      netCents: nets[personId],
      weightCents: weights[personId],
      paidCents: paid[personId],
      owedCents: calculable ? owed[personId] : null,
      sentCents: sent[personId],
      receivedCents: received[personId],
      balanceCents: calculable
        ? paid[personId] + sent[personId] - owed[personId] - received[personId]
        : null,
    }
  }

  let phrase = 'Ripartizione non calcolabile'
  let debtor: PersonId | null = null
  let creditor: PersonId | null = null
  let openDebtCents: number | null = null
  if (calculable) {
    const balance = people.paolo.balanceCents!
    if (balance === 0) {
      phrase = 'Siete in pari'
      openDebtCents = 0
    } else if (balance > 0) {
      phrase = `Cassiana deve a Paolo ${formatEuro(balance)}`
      debtor = 'cassiana'
      creditor = 'paolo'
      openDebtCents = balance
    } else {
      phrase = `Paolo deve a Cassiana ${formatEuro(-balance)}`
      debtor = 'paolo'
      creditor = 'cassiana'
      openDebtCents = -balance
    }
  }

  return {
    calculable,
    reason: missing ? 'missing-income' : calculable ? 'ok' : 'no-positive-weight',
    totalExpensesCents,
    weightSumCents: weightSum,
    percents:
      calculable && weightSum !== null
        ? {
            paolo: Number(roundHalfUpDiv(BigInt(weights.paolo!) * 10000n, BigInt(weightSum))),
            cassiana: Number(roundHalfUpDiv(BigInt(weights.cassiana!) * 10000n, BigInt(weightSum))),
          }
        : null,
    people,
    phrase,
    debtor,
    creditor,
    openDebtCents,
  }
}

export function quotasForAmount(
  amountCents: number,
  computation: MonthComputation,
): { paolo: number; cassiana: number } | null {
  if (!computation.calculable) return null
  const weightPaolo = computation.people.paolo.weightCents
  const weightCassiana = computation.people.cassiana.weightCents
  if (weightPaolo === null || weightCassiana === null) return null
  return quotasCents(amountCents, weightPaolo, weightCassiana)
}
