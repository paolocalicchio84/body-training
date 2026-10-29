export type PersonId = 'paolo' | 'cassiana'

export const PERSON_IDS: readonly PersonId[] = ['paolo', 'cassiana']

export type Person = {
  id: PersonId
  name: string
  voucherUnitCents: number
}

export const PEOPLE: Record<PersonId, Person> = {
  paolo: { id: 'paolo', name: 'Paolo', voucherUnitCents: 450 },
  cassiana: { id: 'cassiana', name: 'Cassiana', voucherUnitCents: 1000 },
}

export type MonthRecord = {
  id: string
  createdAt: string
}

export type IncomeInput = {
  salaryCents: number
  voucherCount: number
  notesCents: number
  extraCents: number
}

export type IncomeRecord = IncomeInput & {
  id: string
  monthId: string
  personId: PersonId
}

export type Category = {
  id: string
  name: string
  archived: boolean
  sort: number
}

export type Expense = {
  id: string
  amountCents: number
  date: string
  paidBy: PersonId
  categoryId: string
  monthId: string
  note: string
  createdAt: string
}

export type Settlement = {
  id: string
  monthId: string
  date: string
  from: PersonId
  to: PersonId
  amountCents: number
  note: string
  createdAt: string
}

export type ProfileSetting = {
  key: 'profile'
  personId: PersonId
}

export const INITIAL_CATEGORIES: Pick<Category, 'id' | 'name'>[] = [
  { id: 'cat-casa', name: 'Casa' },
  { id: 'cat-alimentari', name: 'Alimentari' },
  { id: 'cat-utenze', name: 'Utenze' },
  { id: 'cat-trasporti', name: 'Trasporti' },
  { id: 'cat-salute', name: 'Salute' },
  { id: 'cat-uscite', name: 'Uscite' },
  { id: 'cat-altro', name: 'Altro' },
]

export function incomeRecordId(monthId: string, personId: PersonId): string {
  return `${monthId}:${personId}`
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
