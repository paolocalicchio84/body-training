import {
  INITIAL_CATEGORIES,
  type Category,
  type Expense,
  type IncomeRecord,
  type MonthRecord,
  type PersonId,
  type ProfileSetting,
  type Settlement,
} from './model.ts'

const DB_NAME = 'spese-coppia'
const DB_VERSION = 1

export type DatabaseSnapshot = {
  profile: PersonId
  months: MonthRecord[]
  incomes: IncomeRecord[]
  categories: Category[]
  expenses: Expense[]
  settlements: Settlement[]
}

let databasePromise: Promise<IDBDatabase> | null = null

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Richiesta IndexedDB fallita'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Transazione IndexedDB fallita'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Transazione IndexedDB annullata'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('months')) db.createObjectStore('months', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('incomes')) {
        const store = db.createObjectStore('incomes', { keyPath: 'id' })
        store.createIndex('byMonth', 'monthId')
      }
      if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('expenses')) {
        const store = db.createObjectStore('expenses', { keyPath: 'id' })
        store.createIndex('byMonth', 'monthId')
      }
      if (!db.objectStoreNames.contains('settlements')) {
        const store = db.createObjectStore('settlements', { keyPath: 'id' })
        store.createIndex('byMonth', 'monthId')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('IndexedDB non disponibile'))
    }
  }).then(async (db) => {
    await seedCategories(db)
    return db
  })
  databasePromise = opening
  return opening
}

async function seedCategories(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction('categories', 'readwrite')
  const store = transaction.objectStore('categories')
  const count = await requestToPromise(store.count())
  if (count === 0) {
    INITIAL_CATEGORIES.forEach((category, sort) => {
      store.put({ ...category, archived: false, sort } satisfies Category)
    })
  }
  await transactionDone(transaction)
}

export async function loadSnapshot(): Promise<DatabaseSnapshot> {
  const db = await openDatabase()
  const transaction = db.transaction(
    ['settings', 'months', 'incomes', 'categories', 'expenses', 'settlements'],
    'readonly',
  )
  const settingsRequest = transaction.objectStore('settings').getAll()
  const monthsRequest = transaction.objectStore('months').getAll()
  const incomesRequest = transaction.objectStore('incomes').getAll()
  const categoriesRequest = transaction.objectStore('categories').getAll()
  const expensesRequest = transaction.objectStore('expenses').getAll()
  const settlementsRequest = transaction.objectStore('settlements').getAll()
  const [settings, months, incomes, categories, expenses, settlements] = await Promise.all([
    requestToPromise(settingsRequest),
    requestToPromise(monthsRequest),
    requestToPromise(incomesRequest),
    requestToPromise(categoriesRequest),
    requestToPromise(expensesRequest),
    requestToPromise(settlementsRequest),
  ])
  await transactionDone(transaction)
  const profileSetting = (settings as ProfileSetting[]).find((item) => item.key === 'profile')
  return {
    profile: profileSetting?.personId === 'cassiana' ? 'cassiana' : 'paolo',
    months,
    incomes,
    categories: sortCategories(categories),
    expenses,
    settlements,
  }
}

export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.sort - b.sort || a.name.localeCompare(b.name, 'it'),
  )
}

export async function saveProfile(personId: PersonId): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction('settings', 'readwrite')
  transaction.objectStore('settings').put({ key: 'profile', personId } satisfies ProfileSetting)
  await transactionDone(transaction)
}

export async function ensureMonth(monthId: string): Promise<MonthRecord> {
  const db = await openDatabase()
  const transaction = db.transaction('months', 'readwrite')
  const store = transaction.objectStore('months')
  const existing = await requestToPromise(store.get(monthId) as IDBRequest<MonthRecord | undefined>)
  const record = existing ?? { id: monthId, createdAt: new Date().toISOString() }
  if (!existing) store.put(record)
  await transactionDone(transaction)
  return record
}

export async function saveIncomes(monthId: string, records: IncomeRecord[]): Promise<MonthRecord> {
  const db = await openDatabase()
  const transaction = db.transaction(['incomes', 'months'], 'readwrite')
  const months = transaction.objectStore('months')
  const existing = await requestToPromise(months.get(monthId) as IDBRequest<MonthRecord | undefined>)
  const month = existing ?? { id: monthId, createdAt: new Date().toISOString() }
  if (!existing) months.put(month)
  const incomes = transaction.objectStore('incomes')
  for (const record of records) incomes.put(record)
  await transactionDone(transaction)
  return month
}

export async function saveExpense(expense: Expense): Promise<MonthRecord> {
  const db = await openDatabase()
  const transaction = db.transaction(['expenses', 'months'], 'readwrite')
  const months = transaction.objectStore('months')
  const existing = await requestToPromise(months.get(expense.monthId) as IDBRequest<MonthRecord | undefined>)
  const month = existing ?? { id: expense.monthId, createdAt: new Date().toISOString() }
  if (!existing) months.put(month)
  transaction.objectStore('expenses').put(expense)
  await transactionDone(transaction)
  return month
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction('expenses', 'readwrite')
  transaction.objectStore('expenses').delete(id)
  await transactionDone(transaction)
}

export async function saveSettlement(settlement: Settlement): Promise<MonthRecord> {
  const db = await openDatabase()
  const transaction = db.transaction(['settlements', 'months'], 'readwrite')
  const months = transaction.objectStore('months')
  const existing = await requestToPromise(
    months.get(settlement.monthId) as IDBRequest<MonthRecord | undefined>,
  )
  const month = existing ?? { id: settlement.monthId, createdAt: new Date().toISOString() }
  if (!existing) months.put(month)
  transaction.objectStore('settlements').put(settlement)
  await transactionDone(transaction)
  return month
}

export async function deleteSettlement(id: string): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction('settlements', 'readwrite')
  transaction.objectStore('settlements').delete(id)
  await transactionDone(transaction)
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction('categories', 'readwrite')
  transaction.objectStore('categories').put(category)
  await transactionDone(transaction)
}
