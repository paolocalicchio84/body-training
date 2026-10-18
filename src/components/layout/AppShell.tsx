import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'
import { ErrorBoundary } from './ErrorBoundary'
import { TutorialDialog } from '@/components/tutorial/TutorialDialog'
import { useTutorialController } from '@/features/tutorial/useTutorial'
import { WorkoutClockProvider } from '@/features/workout/WorkoutClock'

export function AppShell() {
  // Montato qui e non nelle singole pagine: il tour si apre al primo
  // accesso ovunque ci si trovi, ed è richiamabile da qualsiasi punto.
  const tutorial = useTutorialController()

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* `min-w-0` sulla colonna e sul contenitore: un flex item ha
          min-width auto, quindi un contenuto largo (una riga di chip
          scorrevole, una tabella) allargherebbe l'intera pagina e
          produrrebbe scroll orizzontale invece di scorrere da solo. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8">
          <div className="mx-auto min-w-0 max-w-5xl">
            <ErrorBoundary>
              <WorkoutClockProvider>
                <Outlet />
              </WorkoutClockProvider>
            </ErrorBoundary>
          </div>
        </main>
        <BottomNav />
      </div>
      <TutorialDialog open={tutorial.open} onClose={tutorial.close} />
    </div>
  )
}
