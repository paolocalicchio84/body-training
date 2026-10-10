import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAiSettings } from '@/features/ai/useAiSettings'

/**
 * Banner shown on Chat / Pasti when no AI provider is active.
 * Points Paolo at Impostazioni → Gemini (key → Testa → provider attivo).
 */
export function GeminiSetupBanner() {
  const { data: settings, isLoading } = useAiSettings()

  if (isLoading || settings?.active_provider) return null

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Configura Gemini per usare l'AI</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Impostazioni → AI → incolla la key Gemini → Testa → scegli un modello
            flash → Salva → Provider attivo = Gemini.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/settings#ai-settings">Configura Gemini</Link>
        </Button>
      </div>
    </div>
  )
}

export function useHasActiveAiProvider(): boolean | null {
  const { data: settings, isLoading } = useAiSettings()
  if (isLoading) return null
  return Boolean(settings?.active_provider)
}
