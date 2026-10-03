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
import { cn } from '@/lib/utils'

const items = [
  { to: '/', icon: Home, label: 'Oggi', disabled: false },
  { to: '/meals', icon: Utensils, label: 'Pasti', disabled: false },
  { to: '/recipes', icon: ChefHat, label: 'Ricette', disabled: false },
  { to: '/allenamento', icon: Dumbbell, label: 'Allenamento', disabled: false },
  { to: '/training', icon: Moon, label: 'Recupero', disabled: false },
  { to: '/chat', icon: MessageCircle, label: 'Chat AI', disabled: false },
  { to: '/andamento', icon: LineChart, label: 'Andamento', disabled: false },
  { to: '/progresso', icon: Camera, label: 'Progresso', disabled: false },
  { to: '/reviews', icon: BarChart3, label: 'Review', disabled: false },
  { to: '/settings', icon: Settings, label: 'Impostazioni', disabled: false },
]

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="border-b border-border px-6 py-5">
        <h1 className="font-mono text-sm font-semibold leading-tight tracking-tight">
          PaoloCalicchio
          <br />
          <span className="text-primary">Body Trainer</span>
        </h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                item.disabled && 'pointer-events-none opacity-40',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.disabled && (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                soon
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        v0.3 · allenamento
      </div>
    </aside>
  )
}
