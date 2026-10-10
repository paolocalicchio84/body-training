import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { SignIn } from './routes/auth/SignIn'
import { SignUp } from './routes/auth/SignUp'
import { ResetPassword } from './routes/auth/ResetPassword'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { importWithReload } from './lib/lazy'

// Lazy-load delle route: ogni pagina in un chunk separato.
// importWithReload forza un reload se il chunk non esiste più (post-deploy).
const Home = lazy(() =>
  importWithReload(() =>
    import('./routes/Home').then((m) => ({ default: m.Home })),
  ),
)
const Meals = lazy(() =>
  importWithReload(() =>
    import('./routes/Meals').then((m) => ({ default: m.Meals })),
  ),
)
const Recipes = lazy(() =>
  importWithReload(() =>
    import('./routes/Recipes').then((m) => ({ default: m.Recipes })),
  ),
)
const Chat = lazy(() =>
  importWithReload(() =>
    import('./routes/Chat').then((m) => ({ default: m.Chat })),
  ),
)
const Reviews = lazy(() =>
  importWithReload(() =>
    import('./routes/Reviews').then((m) => ({ default: m.Reviews })),
  ),
)
const Training = lazy(() =>
  importWithReload(() =>
    import('./routes/Training').then((m) => ({ default: m.Training })),
  ),
)
const Workout = lazy(() =>
  importWithReload(() =>
    import('./routes/Workout').then((m) => ({ default: m.Workout })),
  ),
)
const ActiveSession = lazy(() =>
  importWithReload(() =>
    import('./routes/workout/ActiveSession').then((m) => ({
      default: m.ActiveSession,
    })),
  ),
)
const Trends = lazy(() =>
  importWithReload(() =>
    import('./routes/Trends').then((m) => ({ default: m.Trends })),
  ),
)
const Progresso = lazy(() =>
  importWithReload(() =>
    import('./routes/Progresso').then((m) => ({ default: m.Progresso })),
  ),
)
const Assessment = lazy(() =>
  importWithReload(() =>
    import('./routes/Assessment').then((m) => ({ default: m.Assessment })),
  ),
)
const Settings = lazy(() =>
  importWithReload(() =>
    import('./routes/Settings').then((m) => ({ default: m.Settings })),
  ),
)

function RouteFallback() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

export function App() {
  return (
    <Routes>
      <Route path="/auth/signin" element={<SignIn />} />
      <Route path="/auth/signup" element={<SignUp />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Lazy><Home /></Lazy>} />
        <Route path="/meals" element={<Lazy><Meals /></Lazy>} />
        <Route path="/recipes" element={<Lazy><Recipes /></Lazy>} />
        <Route path="/chat" element={<Lazy><Chat /></Lazy>} />
        <Route path="/reviews" element={<Lazy><Reviews /></Lazy>} />
        <Route path="/training" element={<Lazy><Training /></Lazy>} />
        <Route path="/allenamento" element={<Lazy><Workout /></Lazy>} />
        <Route
          path="/allenamento/sessione"
          element={<Lazy><ActiveSession /></Lazy>}
        />
        <Route path="/andamento" element={<Lazy><Trends /></Lazy>} />
        <Route path="/progresso" element={<Lazy><Progresso /></Lazy>} />
        <Route path="/assessment" element={<Lazy><Assessment /></Lazy>} />
        <Route path="/settings" element={<Lazy><Settings /></Lazy>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
