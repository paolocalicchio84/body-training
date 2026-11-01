import { useEffect, useRef } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'
import { formatMonthTitle, isMonthId } from './dates.ts'
import { PEOPLE, type PersonId } from './model.ts'
import { Balance } from './screens/Balance.tsx'
import { Categories } from './screens/Categories.tsx'
import { ExpenseForm } from './screens/ExpenseForm.tsx'
import { History } from './screens/History.tsx'
import { Home } from './screens/Home.tsx'
import { Incomes } from './screens/Incomes.tsx'
import { StoreProvider, useStore } from './store.tsx'

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<HomeRedirect />} />
            <Route path="mese/:monthId" element={<Home />} />
            <Route path="mese/:monthId/spesa/nuova" element={<ExpenseForm />} />
            <Route path="spesa/:expenseId" element={<ExpenseForm />} />
            <Route path="mese/:monthId/redditi" element={<Incomes />} />
            <Route path="mese/:monthId/saldo" element={<Balance />} />
            <Route path="storico" element={<History />} />
            <Route path="categorie" element={<Categories />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}

function HomeRedirect() {
  const { viewMonthId } = useStore()
  return <Navigate to={`/mese/${viewMonthId}`} replace />
}

function Shell() {
  const { status, error, profile, setProfile, viewMonthId, setViewMonthId, months, openMonth } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const headerRef = useRef<HTMLElement>(null)
  const expenseRoute = /\/spesa(\/|$)/.test(location.pathname)

  useEffect(() => {
    const match = /^\/mese\/(\d{4}-\d{2})/.exec(location.pathname)
    if (match && isMonthId(match[1])) setViewMonthId(match[1])
    window.scrollTo(0, 0)
  }, [location.pathname, setViewMonthId])

  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const write = () => {
      document.documentElement.style.setProperty('--top-h', `${Math.ceil(header.getBoundingClientRect().height)}px`)
    }
    write()
    const observer = new ResizeObserver(write)
    observer.observe(header)
    return () => observer.disconnect()
  }, [status, expenseRoute])

  if (status === 'loading') {
    return <p className="boot">Caricamento dei dati sul dispositivo…</p>
  }
  if (status === 'error') {
    return <p className="boot">{error}</p>
  }

  const routeMonth = /^\/mese\/(\d{4}-\d{2})/.exec(location.pathname)?.[1]
  const activeMonthId = routeMonth && isMonthId(routeMonth) ? routeMonth : viewMonthId
  const monthPath = `/mese/${activeMonthId}`
  const homeMatch = /^\/mese\/(\d{4}-\d{2})$/.exec(location.pathname)

  async function addExpense() {
    if (!months.some((month) => month.id === activeMonthId)) await openMonth(activeMonthId)
    navigate(`/mese/${activeMonthId}/spesa/nuova`)
  }

  return (
    <div className="app">
      <header className="top" ref={headerRef}>
        <div className="bar">
          {homeMatch ? (
            <Link className="brand" to={monthPath}>
              <strong>Spese di coppia</strong>
            </Link>
          ) : (
            <Link className="home-back" to={monthPath}>
              ← Home
            </Link>
          )}
          <NavLink className="gear" to="/categorie" end aria-label="Categorie">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7.2 7.2 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.48-.41h-3.84a.5.5 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.61l2.03 1.58c-.05.31-.08.63-.08.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
              />
            </svg>
          </NavLink>
        </div>
        {homeMatch ? <h1 className="home-month">{formatMonthTitle(homeMatch[1])}</h1> : null}
        {expenseRoute ? null : (
          <div className="who">
            <span className="who-label">Chi usa il telefono</span>
            <div className="switch" role="radiogroup" aria-label="Chi usa il telefono">
              {(['paolo', 'cassiana'] as const).map((personId) => (
                <ProfileButton
                  key={personId}
                  personId={personId}
                  active={profile === personId}
                  onSelect={setProfile}
                />
              ))}
            </div>
          </div>
        )}
      </header>
      <main className="main">
        <Outlet />
      </main>
      <div className="dock">
        <nav className="dock-menu" aria-label="Menu">
          <NavLink to={`${monthPath}/redditi`} end>
            Redditi
          </NavLink>
          <button type="button" className="dock-plus" aria-label="Aggiungi una spesa" onClick={() => void addExpense()}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M10 3.2h4V10h6.8v4H14v6.8h-4V14H3.2v-4H10V3.2z" />
            </svg>
          </button>
          <NavLink to="/storico" end>
            Storico
          </NavLink>
        </nav>
      </div>
    </div>
  )
}

function ProfileButton({
  personId,
  active,
  onSelect,
}: {
  personId: PersonId
  active: boolean
  onSelect: (personId: PersonId) => Promise<void>
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => {
        if (!active) void onSelect(personId)
      }}
    >
      {PEOPLE[personId].name}
    </button>
  )
}
