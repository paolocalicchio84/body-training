import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { computeMonth, type MonthComputation } from './calc.ts'
import {
  deleteExpense,
  deleteSettlement,
  loadSnapshot,
  saveCategory,
  saveExpense,
  saveIncomes,
  saveProfile,
  saveSettlement,
  ensureMonth,
  type DatabaseSnapshot,
} from './db.ts'
import { currentMonthId } from './dates.ts'
import {
  createId,
  incomeRecordId,
  type Category,
  type Expense,
  type IncomeInput,
  type IncomeRecord,
  type PersonId,
  type Settlement,
} from './model.ts'

type StoreStatus = 'loading' | 'ready' | 'error'

type StoreValue = DatabaseSnapshot & {
  status: StoreStatus
  error: string | null
  viewMonthId: string
  setViewMonthId: (monthId: string) => void
  setProfile: (personId: PersonId) => Promise<void>
  openMonth: (monthId: string) => Promise<void>
  saveMonthIncomes: (monthId: string, incomes: Partial<Record<PersonId, IncomeInput>>) => Promise<void>
  addCategory: (name: string) => Promise<void>
  renameCategory: (id: string, name: string) => Promise<void>
  setCategoryArchived: (id: string, archived: boolean) => Promise<void>
  saveExpenseRecord: (expense: Expense) => Promise<void>
  removeExpense: (id: string) => Promise<void>
  saveSettlementRecord: (settlement: Settlement) => Promise<void>
  removeSettlement: (id: string) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index === -1) return [...items, item]
  const next = items.slice()
  next[index] = item
  return next
}

function withMonth(snapshot: DatabaseSnapshot, month: { id: string; createdAt: string }): DatabaseSnapshot {
  if (snapshot.months.some((entry) => entry.id === month.id)) return snapshot
  return { ...snapshot, months: [...snapshot.months, month] }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot | null>(null)
  const [status, setStatus] = useState<StoreStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [viewMonthId, setViewMonthId] = useState(currentMonthId)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot

  useEffect(() => {
    let cancelled = false
    loadSnapshot()
      .then((data) => {
        if (cancelled) return
        setSnapshot(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setError('Impossibile aprire l’archivio locale del browser.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setProfile = useCallback(async (personId: PersonId) => {
    await saveProfile(personId)
    setSnapshot((current) => (current ? { ...current, profile: personId } : current))
  }, [])

  const openMonth = useCallback(async (monthId: string) => {
    const month = await ensureMonth(monthId)
    setSnapshot((current) => (current ? withMonth(current, month) : current))
    setViewMonthId(monthId)
  }, [])

  const saveMonthIncomes = useCallback(
    async (monthId: string, incomes: Partial<Record<PersonId, IncomeInput>>) => {
      const records: IncomeRecord[] = []
      for (const personId of ['paolo', 'cassiana'] as const) {
        const income = incomes[personId]
        if (!income) continue
        records.push({
          ...income,
          id: incomeRecordId(monthId, personId),
          monthId,
          personId,
        })
      }
      const month = await saveIncomes(monthId, records)
      setSnapshot((current) => {
        if (!current) return current
        let incomesNext = current.incomes
        for (const record of records) incomesNext = upsert(incomesNext, record)
        return withMonth({ ...current, incomes: incomesNext }, month)
      })
    },
    [],
  )

  const addCategory = useCallback(async (name: string) => {
    const current = snapshotRef.current
    if (!current) return
    const sort = current.categories.reduce((max, category) => Math.max(max, category.sort), -1) + 1
    const category: Category = { id: createId(), name, archived: false, sort }
    await saveCategory(category)
    setSnapshot((state) =>
      state ? { ...state, categories: [...state.categories, category] } : state,
    )
  }, [])

  const renameCategory = useCallback(async (id: string, name: string) => {
    const category = snapshotRef.current?.categories.find((item) => item.id === id)
    if (!category) return
    const next = { ...category, name }
    await saveCategory(next)
    setSnapshot((state) =>
      state
        ? { ...state, categories: state.categories.map((item) => (item.id === id ? next : item)) }
        : state,
    )
  }, [])

  const setCategoryArchived = useCallback(async (id: string, archived: boolean) => {
    const category = snapshotRef.current?.categories.find((item) => item.id === id)
    if (!category) return
    const next = { ...category, archived }
    await saveCategory(next)
    setSnapshot((state) =>
      state
        ? { ...state, categories: state.categories.map((item) => (item.id === id ? next : item)) }
        : state,
    )
  }, [])

  const saveExpenseRecord = useCallback(async (expense: Expense) => {
    const month = await saveExpense(expense)
    setSnapshot((current) => {
      if (!current) return current
      return withMonth({ ...current, expenses: upsert(current.expenses, expense) }, month)
    })
  }, [])

  const removeExpense = useCallback(async (id: string) => {
    await deleteExpense(id)
    setSnapshot((current) =>
      current ? { ...current, expenses: current.expenses.filter((expense) => expense.id !== id) } : current,
    )
  }, [])

  const saveSettlementRecord = useCallback(async (settlement: Settlement) => {
    const month = await saveSettlement(settlement)
    setSnapshot((current) => {
      if (!current) return current
      return withMonth({ ...current, settlements: upsert(current.settlements, settlement) }, month)
    })
  }, [])

  const removeSettlement = useCallback(async (id: string) => {
    await deleteSettlement(id)
    setSnapshot((current) =>
      current
        ? { ...current, settlements: current.settlements.filter((settlement) => settlement.id !== id) }
        : current,
    )
  }, [])

  const value = useMemo<StoreValue | null>(() => {
    if (!snapshot) {
      return {
        profile: 'paolo',
        months: [],
        incomes: [],
        categories: [],
        expenses: [],
        settlements: [],
        status,
        error,
        viewMonthId,
        setViewMonthId,
        setProfile,
        openMonth,
        saveMonthIncomes,
        addCategory,
        renameCategory,
        setCategoryArchived,
        saveExpenseRecord,
        removeExpense,
        saveSettlementRecord,
        removeSettlement,
      }
    }
    return {
      ...snapshot,
      status,
      error,
      viewMonthId,
      setViewMonthId,
      setProfile,
      openMonth,
      saveMonthIncomes,
      addCategory,
      renameCategory,
      setCategoryArchived,
      saveExpenseRecord,
      removeExpense,
      saveSettlementRecord,
      removeSettlement,
    }
  }, [
    snapshot,
    status,
    error,
    viewMonthId,
    setProfile,
    openMonth,
    saveMonthIncomes,
    addCategory,
    renameCategory,
    setCategoryArchived,
    saveExpenseRecord,
    removeExpense,
    saveSettlementRecord,
    removeSettlement,
  ])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext)
  if (!store) throw new Error('Archivio non disponibile')
  return store
}

export function useMonthData(monthId: string): {
  computation: MonthComputation
  incomes: Record<PersonId, IncomeRecord | null>
  expenses: Expense[]
  settlements: Settlement[]
  open: boolean
} {
  const store = useStore()
  return useMemo(() => {
    const incomes: Record<PersonId, IncomeRecord | null> = {
      paolo: store.incomes.find((income) => income.monthId === monthId && income.personId === 'paolo') ?? null,
      cassiana:
        store.incomes.find((income) => income.monthId === monthId && income.personId === 'cassiana') ?? null,
    }
    const expenses = store.expenses
      .filter((expense) => expense.monthId === monthId)
      .sort(byDateDesc)
    const settlements = store.settlements
      .filter((settlement) => settlement.monthId === monthId)
      .sort(byDateDesc)
    const computation = computeMonth({
      incomes: {
        paolo: incomes.paolo ? toIncomeInput(incomes.paolo) : null,
        cassiana: incomes.cassiana ? toIncomeInput(incomes.cassiana) : null,
      },
      expenses,
      settlements,
    })
    const open =
      store.months.some((month) => month.id === monthId) ||
      incomes.paolo !== null ||
      incomes.cassiana !== null ||
      expenses.length > 0 ||
      settlements.length > 0
    return { computation, incomes, expenses, settlements, open }
  }, [store, monthId])
}

function toIncomeInput(record: IncomeRecord): IncomeInput {
  return {
    salaryCents: record.salaryCents,
    voucherCount: record.voucherCount,
    notesCents: record.notesCents,
    extraCents: record.extraCents,
  }
}

function byDateDesc<T extends { date: string; createdAt: string }>(a: T, b: T): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
}
