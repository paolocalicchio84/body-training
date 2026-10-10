import { useEffect, useState } from 'react'
import { Search, ScanLine, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import {
  FoodBarcodeTab,
  FoodManualTab,
  FoodSearchTab,
  type PickedFood,
} from './FoodPicker'

type Tab = 'search' | 'barcode' | 'manual'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPicked: (p: PickedFood) => void | Promise<void>
}

export function IngredientPickerDialog({
  open,
  onOpenChange,
  onPicked,
}: Props) {
  const [tab, setTab] = useState<Tab>('search')

  useEffect(() => {
    if (open) setTab('search')
  }, [open])

  async function handlePicked(p: PickedFood) {
    await onPicked(p)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aggiungi ingrediente</DialogTitle>
          <DialogDescription>
            Cerca, scansiona o inserisci manualmente. I macro sono snapshottati
            al momento del salvataggio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
          <TabButton
            icon={Search}
            label="Cerca"
            active={tab === 'search'}
            onClick={() => setTab('search')}
          />
          <TabButton
            icon={ScanLine}
            label="Codice a barre"
            active={tab === 'barcode'}
            onClick={() => setTab('barcode')}
          />
          <TabButton
            icon={Pencil}
            label="Rapido"
            active={tab === 'manual'}
            onClick={() => setTab('manual')}
          />
        </div>

        <div className="min-h-[200px]">
          {tab === 'search' && <FoodSearchTab onPicked={handlePicked} />}
          {tab === 'barcode' && <FoodBarcodeTab onPicked={handlePicked} />}
          {tab === 'manual' && <FoodManualTab onPicked={handlePicked} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Search
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-sm py-2 text-xs transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
