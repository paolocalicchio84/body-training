import type { Expense, IncomeRecord } from './model.ts'

/**
 * Caricamento di settembre 2026, non è un seed permanente.
 * Per il reset: metti questo flag a false.
 */
export const CARICA_SETTEMBRE_2026 = false

const MONTH_ID = '2026-09'

const CATEGORY = {
  casa: 'cat-casa',
  alimentari: 'cat-alimentari',
  utenze: 'cat-utenze',
  trasporti: 'cat-trasporti',
  uscite: 'cat-uscite',
  altro: 'cat-altro',
} as const

export const SEPTEMBER_INCOMES: IncomeRecord[] = [
  {
    id: `${MONTH_ID}:paolo`,
    monthId: MONTH_ID,
    personId: 'paolo',
    salaryCents: 207_900,
    voucherCount: 14,
    notesCents: 0,
    extraCents: 0,
  },
  {
    id: `${MONTH_ID}:cassiana`,
    monthId: MONTH_ID,
    personId: 'cassiana',
    salaryCents: 173_224,
    voucherCount: 14,
    notesCents: 0,
    extraCents: 0,
  },
]

type Row = [paidBy: 'paolo' | 'cassiana', date: string, note: string, euros: string, categoryId: string]

const ROWS: Row[] = [
  ['paolo', '2026-09-03', 'acqua', '30.15', CATEGORY.utenze],
  ['paolo', '2026-09-06', 'spesa', '5.05', CATEGORY.alimentari],
  ['paolo', '2026-09-04', 'spesa', '6.99', CATEGORY.alimentari],
  ['paolo', '2026-09-09', 'spesa', '33.23', CATEGORY.alimentari],
  ['paolo', '2026-09-11', 'trasporti', '13', CATEGORY.trasporti],
  ['paolo', '2026-09-20', 'elettricità', '70', CATEGORY.utenze],
  ['paolo', '2026-09-12', 'spesa', '9.20', CATEGORY.alimentari],
  ['paolo', '2026-09-14', 'trasporti', '10', CATEGORY.trasporti],
  ['paolo', '2026-09-14', 'trasporti', '4', CATEGORY.trasporti],
  ['paolo', '2026-09-15', 'benzina viaggio', '58', CATEGORY.trasporti],
  ['paolo', '2026-09-16', 'hotel', '145', CATEGORY.uscite],
  ['paolo', '2026-09-17', 'mangiare fuori', '7', CATEGORY.uscite],
  ['paolo', '2026-09-18', 'spesa', '14', CATEGORY.alimentari],
  ['paolo', '2026-09-18', 'spesa', '13', CATEGORY.alimentari],
  ['paolo', '2026-09-20', 'spesa', '36', CATEGORY.alimentari],
  ['paolo', '2026-09-20', 'spesa', '5.36', CATEGORY.alimentari],
  ['paolo', '2026-09-20', 'spesa', '7', CATEGORY.alimentari],
  ['paolo', '2026-09-26', 'spesa', '29.53', CATEGORY.alimentari],
  ['paolo', '2026-09-27', 'spesa', '7.79', CATEGORY.alimentari],
  ['paolo', '2026-09-27', 'spesa', '9.73', CATEGORY.alimentari],
  ['paolo', '2026-09-29', 'spesa', '11.50', CATEGORY.alimentari],
  ['cassiana', '2026-09-03', 'gas', '21.23', CATEGORY.utenze],
  ['cassiana', '2026-09-05', 'energia', '64.89', CATEGORY.utenze],
  ['cassiana', '2026-09-05', 'spese condominiali', '15.50', CATEGORY.casa],
  ['cassiana', '2026-09-10', 'rifiuti', '40.61', CATEGORY.casa],
  ['cassiana', '2026-09-30', 'buoni pasto', '30', CATEGORY.altro],
  ['cassiana', '2026-09-03', 'lidl', '4.10', CATEGORY.alimentari],
  ['cassiana', '2026-09-14', 'bar', '10', CATEGORY.uscite],
  ['cassiana', '2026-09-15', 'spesa', '30.58', CATEGORY.alimentari],
  ['cassiana', '2026-09-16', 'cena', '64.50', CATEGORY.uscite],
  ['cassiana', '2026-09-17', 'spesa', '14.59', CATEGORY.alimentari],
  ['cassiana', '2026-09-17', 'donna carmela', '70', CATEGORY.uscite],
  ['cassiana', '2026-09-18', 'spesa', '38', CATEGORY.alimentari],
  ['cassiana', '2026-09-30', 'luce', '47', CATEGORY.utenze],
]

function cents(euros: string): number {
  const [whole, frac = ''] = euros.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

export const SEPTEMBER_EXPENSES: Expense[] = ROWS.map(([paidBy, date, note, euros, categoryId], index) => ({
  id: `settembre-2026-${String(index + 1).padStart(2, '0')}`,
  amountCents: cents(euros),
  date,
  paidBy,
  categoryId,
  monthId: MONTH_ID,
  note,
  createdAt: `${date}T12:00:${String(index).padStart(2, '0')}.000Z`,
}))

export async function writeSeptember2026(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(['months', 'incomes', 'expenses'], 'readwrite')
  const months = transaction.objectStore('months')
  const existing = await request(months.get(MONTH_ID) as IDBRequest<{ id: string } | undefined>)
  if (!existing) months.put({ id: MONTH_ID, createdAt: '2026-09-01T00:00:00.000Z' })
  const incomes = transaction.objectStore('incomes')
  for (const income of SEPTEMBER_INCOMES) incomes.put(income)
  const expenses = transaction.objectStore('expenses')
  for (const expense of SEPTEMBER_EXPENSES) expenses.put(expense)
  await done(transaction)
}

function request<T>(query: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    query.onsuccess = () => resolve(query.result)
    query.onerror = () => reject(query.error ?? new Error('Richiesta IndexedDB fallita'))
  })
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Transazione IndexedDB fallita'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Transazione IndexedDB annullata'))
  })
}
