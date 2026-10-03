import { NavLink } from 'react-router-dom'
import {
  Home,
  Utensils,
  ChefHat,
  Dumbbell,
  Moon,
  MessageCircle,
  BarChart3,
  LineChart,
  Camera,
  Settings,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', icon: Home, label: 'Oggi' },
  { to: '/meals', icon: Utensils, label: 'Pasti' },
  { to: '/recipes', icon: ChefHat, label: 'Ricette' },
  { to: '/allenamento', icon: Dumbbell, label: 'Allenamento' },
  { to: '/training', icon: Moon, label: 'Recupero' },
  { to: '/chat', icon: MessageCircle, label: 'Chat AI' },
  { to: '/andamento', icon: LineChart, label: 'Andamento' },
  { to: '/progresso', icon: Camera, label: 'Progresso' },
  { to: '/reviews', icon: BarChart3, label: 'Review' },
  { to: '/settings', icon: Settings, label: 'Impostazioni' },
]

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function MobileMenu({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold">
            PaoloCalicchio <span className="text-primary">Body Trainer</span>
          </DialogTitle>
        </DialogHeader>
        <nav className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => onOpenChange(false)}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-2 rounded-lg border border-border bg-background/50 p-4 text-sm transition-colors',
                  isActive
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  )
}
