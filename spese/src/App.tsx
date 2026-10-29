import { useEffect } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
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
  const { status, error, profile, setProfile, viewMonthId, setViewMonthId } = useStore()
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

  const monthPath = `/mese/${viewMonthId}`
  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <strong>Spese di coppia</strong>
          <span>Paolo e Cassiana</span>
        </div>
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
      <nav className="nav" aria-label="Sezioni">
        <NavLink to={monthPath} end>
          Mese
        </NavLink>
        <NavLink to={`${monthPath}/redditi`}>Redditi</NavLink>
        <NavLink to={`${monthPath}/saldo`}>Saldo</NavLink>
        <NavLink to="/storico">Storico</NavLink>
        <NavLink to="/categorie">Categorie</NavLink>
      </nav>
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
