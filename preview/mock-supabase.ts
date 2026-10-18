// Client Supabase in memoria per la preview UI.
// Le query di react-query partono dai fixture; dopo una mutation la cache
// si invalida e rilegge da qui, così timer, chiusura e modifica durata
// si possono provare senza backend.

import { ACTIVE_SESSION, PERSONAL_RECORDS, ROUTINE_DEEP, ROUTINES, SESSIONS } from './fixtures'

type Row = Record<string, any>

type Op = 'select' | 'update' | 'delete' | 'insert' | 'upsert'

type State = {
  filters: Array<(row: Row) => boolean>
  op: Op
  patch: Row | null
  rows: Row[] | null
  limit: number | null
  order: { col: string; asc: boolean } | null
  mode: 'many' | 'single' | 'maybe'
  conflict: string | null
}

const db = {
  workout_sessions: structuredClone([ACTIVE_SESSION, ...SESSIONS]) as Row[],
  routines: structuredClone(ROUTINES) as Row[],
  routineDeep: { r1: structuredClone(ROUTINE_DEEP) } as Record<string, Row>,
  personal_records: structuredClone(PERSONAL_RECORDS) as Row[],
  workouts: [] as Row[],
}

function liveRows(table: string): Row[] {
  if (table === 'workout_sessions') return db.workout_sessions
  if (table === 'routines') return db.routines
  if (table === 'personal_records') return db.personal_records
  if (table === 'workouts') return db.workouts
  if (table === 'session_sets') {
    const sets: Row[] = []
    for (const session of db.workout_sessions) {
      for (const se of session.session_exercises ?? []) {
        for (const set of se.session_sets ?? []) sets.push(set)
      }
    }
    return sets
  }
  if (table === 'session_exercises') {
    const rows: Row[] = []
    for (const session of db.workout_sessions) {
      for (const se of session.session_exercises ?? []) rows.push(se)
    }
    return rows
  }
  return []
}

function dropSessionSets(predicate: (row: Row) => boolean) {
  for (const session of db.workout_sessions) {
    for (const se of session.session_exercises ?? []) {
      se.session_sets = (se.session_sets ?? []).filter((set: Row) => !predicate(set))
    }
  }
}

function matches(row: Row, filters: Array<(row: Row) => boolean>) {
  return filters.every((fn) => fn(row))
}

function sortLimit(rows: Row[], state: State): Row[] {
  const copy = [...rows]
  if (state.order) {
    const { col, asc } = state.order
    copy.sort((a, b) => {
      const av = a[col]
      const bv = b[col]
      if (av === bv) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return (av < bv ? -1 : 1) * (asc ? 1 : -1)
    })
  }
  return state.limit != null ? copy.slice(0, state.limit) : copy
}

function projectRoutine(row: Row): Row {
  const deep = db.routineDeep[row.id]
  return structuredClone(deep ? { ...deep, ...row } : row)
}

function execute(table: string, state: State): { data: unknown; error: { message: string } | null } {
  if (table === 'rpc') return { data: [], error: null }

  if (state.op === 'insert') {
    const rows = state.rows ?? []
    if (table === 'session_sets') {
      for (const row of rows) {
        for (const session of db.workout_sessions) {
          for (const se of session.session_exercises ?? []) {
            if (se.id === row.session_exercise_id) {
              se.session_sets = [...(se.session_sets ?? []), row]
            }
          }
        }
      }
    } else if (liveRows(table)) {
      const bucket = liveRows(table)
      if (table === 'workout_sessions' || table === 'workouts' || table === 'personal_records' || table === 'routines') {
        bucket.push(...rows)
      }
    }
    const data = state.mode === 'many' ? structuredClone(rows) : structuredClone(rows[0] ?? null)
    return { data, error: null }
  }

  if (state.op === 'upsert') {
    const row = state.rows?.[0]
    if (!row) return { data: null, error: null }
    const key = state.conflict
    const bucket = liveRows(table)
    if (key && row[key] != null) {
      const found = bucket.find((r) => r[key] === row[key])
      if (found) Object.assign(found, row)
      else bucket.push({ id: crypto.randomUUID(), ...row })
    } else {
      bucket.push({ id: crypto.randomUUID(), ...row })
    }
    return { data: structuredClone(row), error: null }
  }

  if (state.op === 'delete') {
    if (table === 'session_sets') {
      dropSessionSets((row) => matches(row, state.filters))
      return { data: null, error: null }
    }
    const bucket = liveRows(table)
    for (let i = bucket.length - 1; i >= 0; i -= 1) {
      if (matches(bucket[i], state.filters)) bucket.splice(i, 1)
    }
    return { data: null, error: null }
  }

  if (state.op === 'update') {
    const bucket = liveRows(table)
    for (const row of bucket) {
      if (!matches(row, state.filters)) continue
      Object.assign(row, state.patch ?? {})
      if (table === 'routines' && db.routineDeep[row.id]) {
        Object.assign(db.routineDeep[row.id], state.patch ?? {})
      }
    }
    return { data: null, error: null }
  }

  let rows = liveRows(table).filter((row) => matches(row, state.filters))
  if (table === 'routines') rows = rows.map((row) => projectRoutine(row))
  else rows = rows.map((row) => structuredClone(row))
  rows = sortLimit(rows, state)

  if (state.mode === 'maybe') {
    return { data: rows[0] ?? null, error: null }
  }
  if (state.mode === 'single') {
    if (!rows[0]) return { data: null, error: { message: 'No rows' } }
    return { data: rows[0], error: null }
  }
  return { data: rows, error: null }
}

function makeBuilder(table: string) {
  const state: State = {
    filters: [],
    op: 'select',
    patch: null,
    rows: null,
    limit: null,
    order: null,
    mode: 'many',
    conflict: null,
  }
  const builder: Record<string, unknown> = {}
  for (const method of [
    'select',
    'neq',
    'gte',
    'lte',
    'gt',
    'lt',
    'or',
    'range',
    'filter',
    'contains',
    'ilike',
    'is',
  ]) {
    builder[method] = () => builder
  }
  builder.eq = (col: string, val: unknown) => {
    state.filters.push((row) => row[col] === val)
    return builder
  }
  builder.in = (col: string, vals: unknown[]) => {
    const set = new Set(vals)
    state.filters.push((row) => set.has(row[col]))
    return builder
  }
  builder.order = (col: string, opts?: { ascending?: boolean }) => {
    state.order = { col, asc: opts?.ascending !== false }
    return builder
  }
  builder.limit = (n: number) => {
    state.limit = n
    return builder
  }
  builder.update = (patch: Row) => {
    state.op = 'update'
    state.patch = patch
    return builder
  }
  builder.delete = () => {
    state.op = 'delete'
    return builder
  }
  builder.insert = (rows: Row | Row[]) => {
    state.op = 'insert'
    state.rows = Array.isArray(rows) ? rows : [rows]
    return builder
  }
  builder.upsert = (row: Row, opts?: { onConflict?: string }) => {
    state.op = 'upsert'
    state.rows = [row]
    state.conflict = opts?.onConflict ?? null
    return builder
  }
  builder.single = () => {
    state.mode = 'single'
    return builder
  }
  builder.maybeSingle = () => {
    state.mode = 'maybe'
    return builder
  }
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(execute(table, state)).then(resolve, reject)
  return builder
}

export const isSupabaseConfigured = true

export const supabase = {
  from: (table: string) => makeBuilder(table),
  rpc: () => makeBuilder('rpc'),
  auth: {
    getSession: async () => ({ data: { session: null } }),
    getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
      upload: async () => ({ data: null, error: null }),
    }),
  },
} as never
