import { useState } from 'react'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { MobileMenu } from './MobileMenu'

export function Topbar() {
  const { signOut, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-mono text-sm font-semibold">MyHealthyLife</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Esci">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}
