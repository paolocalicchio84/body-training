import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeMonth, netIncomeCents, quotasCents, readIncomeDraft, weightFromNet } from './calc.ts'
import { isValidDate } from './dates.ts'
import { formatEuro, parseMoneyToCents, parseVoucherCount } from './money.ts'
import { PEOPLE, type IncomeInput } from './model.ts'

const PAOLO: IncomeInput = {
  salaryCents: 220_000,
  voucherCount: 10,
  notesCents: 10_000,
  extraCents: 0,
}
const CASSIANA: IncomeInput = {
  salaryCents: 160_000,
  voucherCount: 8,
  notesCents: 0,
  extraCents: 15_000,
}

describe('reddito netto e peso', () => {
  it('calcola l’esempio di ottobre, mutuo compreso', () => {
    assert.equal(PEOPLE.paolo.mortgageCents, 29_126)
    assert.equal(PEOPLE.cassiana.mortgageCents, 42_567)
    assert.equal(netIncomeCents('paolo', PAOLO), 185_374)
    assert.equal(netIncomeCents('cassiana', CASSIANA), 140_433)
    assert.equal(formatEuro(185_374), '1.853,74 €')
    assert.equal(formatEuro(140_433), '1.404,33 €')
    assert.equal(formatEuro(29_126), '291,26 €')
    assert.equal(formatEuro(42_567), '425,67 €')
  })

  it('il mutuo non è un campo del reddito del mese', () => {
    const read = readIncomeDraft('paolo', { salary: '2200', vouchers: '10', notes: '100', extra: '0' })
    assert.ok(read.income)
    assert.equal('mortgageCents' in read.income, false)
  })

  it('mette il peso a 0 se il netto è zero o negativo, e lascia il netto visibile', () => {
    assert.equal(weightFromNet(0), 0)
    assert.equal(weightFromNet(-3_000), 0)
    const negative = readIncomeDraft('paolo', {
      salary: '391,26',
      vouchers: '0',
      notes: '130',
      extra: '0',
    })
    assert.equal(negative.netCents, -3_000)
    assert.equal(negative.weightCents, 0)
  })

  it('non trasforma un campo vuoto in zero finché lo stipendio non è confermato', () => {
    const empty = readIncomeDraft('paolo', { salary: '', vouchers: '', notes: '', extra: '' })
    assert.equal(empty.salaryEmpty, true)
    assert.equal(empty.income, null)
    assert.equal(empty.netCents, null)
    assert.deepEqual(empty.errors, [])

    const zero = readIncomeDraft('cassiana', { salary: '0', vouchers: '', notes: '', extra: '' })
    assert.deepEqual(zero.income, {
      salaryCents: 0,
      voucherCount: 0,
      notesCents: 0,
      extraCents: 0,
    })
    assert.equal(zero.netCents, -42_567)
    assert.equal(zero.weightCents, 0)
  })

  it('al salvataggio i buoni, le note spese e gli extra vuoti valgono 0', () => {
    const read = readIncomeDraft('paolo', { salary: '2200', vouchers: '10', notes: '', extra: '' })
    assert.deepEqual(read.income, {
      salaryCents: 220_000,
      voucherCount: 10,
      notesCents: 0,
      extraCents: 0,
    })
    assert.equal(read.voucherCents, 4_500)
  })
})

describe('ripartizione e arrotondamento', () => {
  it('divide la spesa da 150 € dell’esempio', () => {
    const quota = quotasCents(15_000, 185_374, 140_433)
    assert.deepEqual(quota, { paolo: 8_535, cassiana: 6_465 })
    assert.equal(quota.paolo + quota.cassiana, 15_000)
    assert.equal(formatEuro(quota.cassiana), '64,65 €')
    assert.equal(formatEuro(quota.paolo), '85,35 €')
  })

  it('arrotonda ogni spesa da sola e non riarrotonda il totale', () => {
    const month = computeMonth({
      incomes: { paolo: PAOLO, cassiana: CASSIANA },
      expenses: [
        { amountCents: 15_000, paidBy: 'paolo' },
        { amountCents: 2_000, paidBy: 'cassiana' },
      ],
      settlements: [],
    })
    assert.equal(month.calculable, true)
    assert.equal(month.people.paolo.owedCents, 9_673)
    assert.equal(month.people.cassiana.owedCents, 7_327)
    assert.equal(month.people.paolo.owedCents! + month.people.cassiana.owedCents!, 17_000)
    assert.equal(month.people.paolo.paidCents, 15_000)
    assert.equal(month.people.cassiana.paidCents, 2_000)
    assert.equal(month.people.paolo.balanceCents, 5_327)
    assert.equal(month.people.cassiana.balanceCents, -5_327)
    assert.equal(month.phrase, 'Cassiana deve a Paolo 53,27 €')
    assert.equal(month.totalExpensesCents, 17_000)
    assert.deepEqual(month.percents, { paolo: 5690, cassiana: 4310 })
  })

  it('dal mezzo centesimo in su sale, e lo scarto resta su Paolo', () => {
    const quota = quotasCents(1, 1, 1)
    assert.deepEqual(quota, { paolo: 0, cassiana: 1 })
    const two = computeMonth({
      incomes: {
        paolo: { salaryCents: 29_127, voucherCount: 0, notesCents: 0, extraCents: 0 },
        cassiana: { salaryCents: 42_568, voucherCount: 0, notesCents: 0, extraCents: 0 },
      },
      expenses: [
        { amountCents: 1, paidBy: 'paolo' },
        { amountCents: 1, paidBy: 'paolo' },
      ],
      settlements: [],
    })
    assert.equal(two.people.cassiana.owedCents, 2)
    assert.equal(two.people.paolo.owedCents, 0)
    assert.equal(two.phrase, 'Cassiana deve a Paolo 0,02 €')
  })

  it('con un solo peso positivo la quota è tutta di quella persona', () => {
    const month = computeMonth({
      incomes: {
        paolo: PAOLO,
        cassiana: { salaryCents: 0, voucherCount: 0, notesCents: 0, extraCents: 0 },
      },
      expenses: [{ amountCents: 4_000, paidBy: 'cassiana' }],
      settlements: [],
    })
    assert.equal(month.people.cassiana.netCents, -42_567)
    assert.equal(month.people.cassiana.weightCents, 0)
    assert.equal(month.people.paolo.owedCents, 4_000)
    assert.equal(month.people.cassiana.owedCents, 0)
    assert.equal(month.phrase, 'Paolo deve a Cassiana 40,00 €')
  })

  it('un netto negativo non viene sottratto dal saldo dell’altro', () => {
    const month = computeMonth({
      incomes: {
        paolo: { salaryCents: 39_126, voucherCount: 0, notesCents: 13_000, extraCents: 0 },
        cassiana: { salaryCents: 52_567, voucherCount: 0, notesCents: 0, extraCents: 0 },
      },
      expenses: [{ amountCents: 1_000, paidBy: 'paolo' }],
      settlements: [],
    })
    assert.equal(month.people.paolo.netCents, -3_000)
    assert.equal(month.people.paolo.weightCents, 0)
    assert.equal(month.people.paolo.owedCents, 0)
    assert.equal(month.people.cassiana.owedCents, 1_000)
    assert.equal(month.people.paolo.balanceCents, 1_000)
    assert.equal(month.phrase, 'Cassiana deve a Paolo 10,00 €')
  })

  it('senza un peso positivo, o con un reddito mancante, non c’è saldo in euro', () => {
    const bothZero = computeMonth({
      incomes: {
        paolo: { salaryCents: 0, voucherCount: 0, notesCents: 0, extraCents: 0 },
        cassiana: { salaryCents: 0, voucherCount: 0, notesCents: 0, extraCents: 0 },
      },
      expenses: [{ amountCents: 1_000, paidBy: 'paolo' }],
      settlements: [],
    })
    assert.equal(bothZero.calculable, false)
    assert.equal(bothZero.reason, 'no-positive-weight')
    assert.equal(bothZero.people.paolo.balanceCents, null)
    assert.equal(bothZero.phrase, 'Ripartizione non calcolabile')
    assert.equal(bothZero.totalExpensesCents, 1_000)

    const missing = computeMonth({
      incomes: { paolo: PAOLO, cassiana: null },
      expenses: [{ amountCents: 15_000, paidBy: 'paolo' }],
      settlements: [],
    })
    assert.equal(missing.reason, 'missing-income')
    assert.equal(missing.people.paolo.paidCents, 15_000)
    assert.equal(missing.people.paolo.owedCents, null)
    assert.equal(missing.openDebtCents, null)
  })
})

describe('versamenti di pareggio', () => {
  const expenses = [
    { amountCents: 15_000, paidBy: 'paolo' as const },
    { amountCents: 2_000, paidBy: 'cassiana' as const },
  ]

  it('un versamento dell’importo proposto chiude il mese e non entra nel totale spese', () => {
    const closed = computeMonth({
      incomes: { paolo: PAOLO, cassiana: CASSIANA },
      expenses,
      settlements: [{ amountCents: 5_327, from: 'cassiana', to: 'paolo' }],
    })
    assert.equal(closed.totalExpensesCents, 17_000)
    assert.equal(closed.people.cassiana.sentCents, 5_327)
    assert.equal(closed.people.paolo.receivedCents, 5_327)
    assert.equal(closed.people.paolo.balanceCents, 0)
    assert.equal(closed.people.cassiana.balanceCents, 0)
    assert.equal(closed.phrase, 'Siete in pari')
  })

  it('un acconto riduce il debito e un versamento annullato lo riapre', () => {
    const partial = computeMonth({
      incomes: { paolo: PAOLO, cassiana: CASSIANA },
      expenses,
      settlements: [{ amountCents: 2_000, from: 'cassiana', to: 'paolo' }],
    })
    assert.equal(partial.phrase, 'Cassiana deve a Paolo 33,27 €')

    const cancelled = computeMonth({
      incomes: { paolo: PAOLO, cassiana: CASSIANA },
      expenses,
      settlements: [],
    })
    assert.equal(cancelled.phrase, 'Cassiana deve a Paolo 53,27 €')
  })

  it('senza più spese il versamento resta e il saldo può cambiare segno', () => {
    const flipped = computeMonth({
      incomes: { paolo: PAOLO, cassiana: CASSIANA },
      expenses: [],
      settlements: [{ amountCents: 5_327, from: 'cassiana', to: 'paolo' }],
    })
    assert.equal(flipped.totalExpensesCents, 0)
    assert.equal(flipped.phrase, 'Paolo deve a Cassiana 53,27 €')
  })
})

describe('i mesi non si mischiano', () => {
  it('il reddito di ottobre non entra nel calcolo di novembre, e stipendi uguali non fanno metà perché i mutui sono diversi', () => {
    const october = computeMonth({
      incomes: { paolo: PAOLO, cassiana: CASSIANA },
      expenses: [{ amountCents: 15_000, paidBy: 'paolo' }],
      settlements: [],
    })
    const november = computeMonth({
      incomes: {
        paolo: { salaryCents: 100_000, voucherCount: 0, notesCents: 0, extraCents: 0 },
        cassiana: { salaryCents: 100_000, voucherCount: 0, notesCents: 0, extraCents: 0 },
      },
      expenses: [{ amountCents: 15_000, paidBy: 'paolo' }],
      settlements: [],
    })
    assert.equal(october.people.cassiana.owedCents, 6_465)
    assert.equal(november.people.paolo.netCents, 70_874)
    assert.equal(november.people.cassiana.netCents, 57_433)
    assert.equal(november.people.paolo.owedCents, 8_286)
    assert.equal(november.people.cassiana.owedCents, 6_714)
    assert.notEqual(october.people.paolo.netCents, november.people.paolo.netCents)
  })
})

describe('importi e date', () => {
  it('accetta gli euro italiani e rifiuta i millesimi', () => {
    assert.equal(parseMoneyToCents('150'), 15_000)
    assert.equal(parseMoneyToCents('150,5'), 15_050)
    assert.equal(parseMoneyToCents('2.200,00'), 220_000)
    assert.equal(parseMoneyToCents('0,01'), 1)
    assert.equal(parseMoneyToCents('0'), 0)
    assert.equal(parseMoneyToCents('0,005'), null)
    assert.equal(parseMoneyToCents('-1'), null)
    assert.equal(parseMoneyToCents(''), null)
    assert.equal(parseMoneyToCents('1.60'), null)
    assert.equal(parseVoucherCount('8'), 8)
    assert.equal(parseVoucherCount('0'), 0)
    assert.equal(parseVoucherCount('1,5'), null)
    assert.equal(parseVoucherCount('-1'), null)
  })

  it('riconosce solo i giorni di calendario', () => {
    assert.equal(isValidDate('2026-10-29'), true)
    assert.equal(isValidDate('2024-02-29'), true)
    assert.equal(isValidDate('2026-02-29'), false)
    assert.equal(isValidDate('2026-04-31'), false)
  })
})
