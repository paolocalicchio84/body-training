import { useEffect } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'
import { isMonthId } from './dates.ts'
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
  const { status, error, profile, setProfile, viewMonthId, setViewMonthId, months } = useStore()
  const location = useLocation()

  useEffect(() => {
    const match = /^\/mese\/(\d{4}-\d{2})/.exec(location.pathname)
    if (match && isMonthId(match[1])) setViewMonthId(match[1])
    window.scrollTo(0, 0)
  }, [location.pathname, setViewMonthId])

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
  const showAdd = Boolean(homeMatch && months.some((month) => month.id === homeMatch[1]))
  return (
    <div className={showAdd ? 'app with-add' : 'app'}>
      <header className="top">
        {homeMatch ? null : (
          <Link className="home-back" to={monthPath}>
            ← Home
          </Link>
        )}
        <Link className="brand" to={monthPath}>
          <strong>Spese di coppia</strong>
          <span>Paolo e Cassiana</span>
        </Link>
        <div className="switch" role="radiogroup" aria-label="Profilo attivo">
          {(['paolo', 'cassiana'] as const).map((personId) => (
            <ProfileButton
              key={personId}
              personId={personId}
              active={profile === personId}
              onSelect={setProfile}
            />
          ))}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <div className="dock">
        <nav className="dock-menu" aria-label="Menu">
          <NavLink to={`${monthPath}/redditi`} end>
            Redditi
          </NavLink>
          <NavLink to="/storico" end>
            Storico
          </NavLink>
          <NavLink to="/categorie" end>
            Categorie
          </NavLink>
        </nav>
        {showAdd && homeMatch ? (
          <Link className="dock-add" to={`/mese/${homeMatch[1]}/spesa/nuova`}>
            Aggiungi una spesa
          </Link>
        ) : null}
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
