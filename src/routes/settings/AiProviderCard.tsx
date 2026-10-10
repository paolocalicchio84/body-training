import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, KeyRound, Loader2, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Separator } from '@/components/ui/Separator'
import {
  useDeleteKey,
  useListModels,
  useSaveKey,
  type AiCredential,
  type ModelInfo,
  type Provider,
} from '@/features/ai/useAiCredentials'

const LABELS: Record<Provider, { name: string; hint: string; keyHint: string }> = {
  openai: {
    name: 'OpenAI',
    hint: 'Modelli GPT, embedding (text-embedding-3).',
    keyHint: 'La key inizia con sk-…',
  },
  gemini: {
    name: 'Google Gemini',
    hint: 'Modelli Gemini 1.5 / 2.0 / 2.5, embedding.',
    keyHint: 'La key inizia con AIza…',
  },
}

export function AiProviderCard({
  provider,
  credential,
  recommended = false,
}: {
  provider: Provider
  credential: AiCredential | undefined
  recommended?: boolean
}) {
  const labels = LABELS[provider]
  const isConfigured = !!credential

  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string | null>(
    credential?.default_model ?? null,
  )

  const listModels = useListModels()
  const saveKey = useSaveKey()
  const deleteKey = useDeleteKey()

  useEffect(() => {
    setSelectedModel(credential?.default_model ?? null)
  }, [credential?.default_model])

  async function handleTest() {
    if (!apiKey.trim()) {
      toast.error('Incolla prima la API key')
      return
    }
    try {
      const result = await listModels.mutateAsync({ provider, api_key: apiKey })
      setModels(result)
      toast.success(`${result.length} modelli disponibili`)
      if (!selectedModel && result.length > 0) {
        // preseleziona il primo modello chat
        const firstChat =
          result.find((m) => m.category === 'chat') ?? result[0]
        setSelectedModel(firstChat.id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test fallito')
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      toast.error('Incolla la API key')
      return
    }
    if (!selectedModel) {
      toast.error('Seleziona un modello di default')
      return
    }
    try {
      await saveKey.mutateAsync({
        provider,
        api_key: apiKey,
        default_model: selectedModel,
      })
      toast.success(`${labels.name} connesso`)
      setApiKey('')
      setModels([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio fallito')
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminare la API key di ${labels.name}?`)) return
    try {
      await deleteKey.mutateAsync({ provider })
      toast.success('API key eliminata')
      setApiKey('')
      setModels([])
      setSelectedModel(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eliminazione fallita')
    }
  }

  const isBusy = listModels.isPending || saveKey.isPending || deleteKey.isPending

  return (
    <div
      className={
        recommended
          ? 'rounded-lg border border-primary/40 bg-primary/5 p-4'
          : 'rounded-lg border border-border bg-background/40 p-4'
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{labels.name}</h4>
            {recommended && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                Consigliato: Gemini
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{labels.hint}</p>
        </div>
        <StatusBadge configured={isConfigured} />
      </div>

      {isConfigured && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono">
            ••••••••{credential!.key_last4}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {credential!.default_model ?? 'nessun modello'}
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isBusy}
            aria-label="Elimina key"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`${provider}-key`}>
            {isConfigured ? 'Sostituisci API key' : 'Nuova API key'}
          </Label>
          <div className="flex gap-2">
            <Input
              id={`${provider}-key`}
              type="password"
              autoComplete="off"
              placeholder={labels.keyHint}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isBusy || !apiKey.trim()}
            >
              {listModels.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Testa'
              )}
            </Button>
          </div>
        </div>

        {models.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor={`${provider}-model`}>Modello di default</Label>
              <Select
                value={selectedModel ?? undefined}
                onValueChange={setSelectedModel}
              >
                <SelectTrigger id={`${provider}-model`}>
                  <SelectValue placeholder="Seleziona un modello…" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-mono text-xs">{m.id}</span>
                      {m.category && m.category !== 'chat' && (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          {m.category}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Suggeriti per costo minimo:{' '}
                <span className="font-mono">
                  {provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}
                </span>
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveKey.isPending || !selectedModel}
            >
              {saveKey.isPending ? 'Salvataggio…' : 'Salva e connetti'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
        <Check className="h-3 w-3" />
        Connesso
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
      <X className="h-3 w-3" />
      Non configurato
    </span>
  )
}
