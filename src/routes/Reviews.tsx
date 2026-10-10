import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format, parseISO, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Check,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Trash2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/utils'
import { round0 } from '@/lib/macro'
import {
  useApplyReview,
  useDeleteReview,
  useDismissReview,
  useGenerateReview,
  useReviews,
  type PhaseReview,
} from '@/features/reviews/useReviews'
import { SectionHelp } from '@/components/tutorial/SectionHelp'

export function Reviews() {
  const { data: reviews = [], isLoading } = useReviews()
  const generate = useGenerateReview()
  const apply = useApplyReview()
  const dismiss = useDismissReview()
  const del = useDeleteReview()

  const [expanded, setExpanded] = useState<string | null>(null)

  const latest = reviews[0]
  const history = reviews.slice(1)

  const daysSinceLatest = latest
    ? differenceInDays(new Date(), parseISO(latest.reviewed_at))
    : null

  async function handleGenerate() {
    try {
      const res = await generate.mutateAsync()
      toast.success(
        `Revisione generata (${res.cost_cents < 1 ? '<1¢' : (res.cost_cents / 100).toFixed(2) + '¢'})`,
      )
      setExpanded(res.review.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleApply(r: PhaseReview) {
    if (!confirm('Applicare i nuovi target? I tuoi target attuali verranno sostituiti.')) return
    try {
      await apply.mutateAsync(r)
      toast.success('Target aggiornati')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDismiss(id: string) {
    try {
      await dismiss.mutateAsync(id)
      toast.success('Revisione archiviata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa revisione?')) return
    try {
      await del.mutateAsync(id)
      toast.success('Eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
            Revisione
            <SectionHelp id="reviews" />
          </p>
          <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            Analisi bisettimanale
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            L'AI valuta aderenza ai target e trend del peso sugli ultimi 14 giorni,
            e suggerisce eventuali aggiustamenti.
          </p>
        </div>
        <Button type="button" onClick={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisi in corso…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Genera revisione
            </>
          )}
        </Button>
      </div>

      {/* Helper stato */}
      {latest && daysSinceLatest != null && (
        <div className="rounded-md border border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground">
          Ultima revisione: {daysSinceLatest === 0 ? 'oggi' : `${daysSinceLatest} giorni fa`}
          {daysSinceLatest >= 14 && ' — è il momento di generarne una nuova.'}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nessuna review generata ancora.
            </p>
            <p className="text-xs text-muted-foreground">
              Serve almeno qualche giorno di dati loggati per avere un'analisi sensata.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {latest && (
            <ReviewCard
              review={latest}
              expanded={expanded === latest.id || expanded === null}
              onToggleExpand={() =>
                setExpanded(expanded === latest.id ? null : latest.id)
              }
              onApply={() => handleApply(latest)}
              onDismiss={() => handleDismiss(latest.id)}
              onDelete={() => handleDelete(latest.id)}
              isApplying={apply.isPending}
              isDismissing={dismiss.isPending}
              isDeleting={del.isPending}
              isLatest
            />
          )}

          {history.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                Storico review ({history.length})
              </h3>
              {history.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  expanded={expanded === r.id}
                  onToggleExpand={() =>
                    setExpanded(expanded === r.id ? null : r.id)
                  }
                  onApply={() => handleApply(r)}
                  onDismiss={() => handleDismiss(r.id)}
                  onDelete={() => handleDelete(r.id)}
                  isApplying={apply.isPending}
                  isDismissing={dismiss.isPending}
                  isDeleting={del.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// ReviewCard
// ============================================================
function ReviewCard({
  review: r,
  expanded,
  onToggleExpand,
  onApply,
  onDismiss,
  onDelete,
  isApplying,
  isDismissing,
  isDeleting,
  isLatest,
}: {
  review: PhaseReview
  expanded: boolean
  onToggleExpand: () => void
  onApply: () => void
  onDismiss: () => void
  onDelete: () => void
  isApplying: boolean
  isDismissing: boolean
  isDeleting: boolean
  isLatest?: boolean
}) {
  const sug = r.ai_suggestion
  const hasPendingSuggestion =
    sug?.status === 'adjust_needed' &&
    sug.suggested_changes != null &&
    !r.applied &&
    !r.dismissed

  const statusStyle = useMemo(() => {
    if (!sug) return { bg: 'border-border', label: '—' }
    if (sug.status === 'insufficient_data')
      return {
        bg: 'border-border',
        label: 'Dati insufficienti',
        color: 'text-muted-foreground',
      }
    if (sug.status === 'on_track')
      return {
        bg: 'border-primary/40 bg-primary/5',
        label: 'On track',
        color: 'text-primary',
      }
    return {
      bg: 'border-warning/40 bg-warning/5',
      label: 'Aggiustamento suggerito',
      color: 'text-warning',
    }
  }, [sug])

  return (
    <Card className={cn('border', statusStyle.bg)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className={cn('text-[10px] uppercase tracking-widest', statusStyle.color)}>
                {statusStyle.label}
              </span>
              {isLatest && !r.applied && !r.dismissed && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                  più recente
                </span>
              )}
              {r.applied && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-primary">
                  <Check className="h-2.5 w-2.5" />
                  applicata
                </span>
              )}
              {r.dismissed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                  <X className="h-2.5 w-2.5" />
                  archiviata
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {format(parseISO(r.period_start), 'd MMM', { locale: it })} →{' '}
              {format(parseISO(r.period_end), 'd MMM yyyy', { locale: it })} ·{' '}
              {r.days_with_data} giorni con dati · generata{' '}
              {format(parseISO(r.reviewed_at), "d MMM 'ore' HH:mm", { locale: it })}
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand}>
            {expanded ? 'Riduci' : 'Dettagli'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {sug?.summary && (
          <p className="text-sm leading-relaxed">{sug.summary}</p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            label="Kcal medie"
            value={r.avg_kcal != null ? round0(r.avg_kcal) : '—'}
            target={r.target_kcal_at_review}
            adherence={r.adherence_pct_kcal}
          />
          <MetricTile
            label="Proteine"
            value={
              r.avg_protein_g != null ? `${round0(r.avg_protein_g)}g` : '—'
            }
            target={r.target_protein_at_review}
            adherence={r.adherence_pct_protein}
          />
          <WeightTile
            weightStart={r.weight_start}
            weightEnd={r.weight_end}
            weightDelta={r.weight_delta}
          />
          <MetricTile
            label="Rating"
            value={labelAdherence(sug?.adherence_rating) || '—'}
            small
          />
        </div>

        {expanded && (
          <>
            {sug?.reasoning && (
              <>
                <Separator />
                <div className="prose-chat text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {sug.reasoning}
                  </ReactMarkdown>
                </div>
              </>
            )}

            {hasPendingSuggestion && sug?.suggested_changes && (
              <>
                <Separator />
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
                  <h4 className="text-sm font-semibold">Nuovi target proposti</h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ChangeTile
                      label="Kcal"
                      current={r.target_kcal_at_review}
                      proposed={sug.suggested_changes.target_kcal}
                    />
                    <ChangeTile
                      label="Proteine"
                      current={r.target_protein_at_review}
                      proposed={sug.suggested_changes.target_protein_g}
                      unit="g"
                    />
                    <ChangeTile
                      label="Carbo"
                      current={r.target_carb_at_review}
                      proposed={sug.suggested_changes.target_carb_g}
                      unit="g"
                    />
                    <ChangeTile
                      label="Grassi"
                      current={r.target_fat_at_review}
                      proposed={sug.suggested_changes.target_fat_g}
                      unit="g"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={onApply}
                      disabled={isApplying}
                    >
                      <Check className="h-4 w-4" />
                      {isApplying ? 'Applicazione…' : 'Applica questi target'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onDismiss}
                      disabled={isDismissing}
                    >
                      Rifiuta
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Footer meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {r.model && <span className="font-mono">{r.model}</span>}
              {r.cost_usd_cents != null && r.cost_usd_cents > 0 && (
                <span className="font-mono tabular">
                  {r.cost_usd_cents < 1
                    ? '<1¢'
                    : `${(r.cost_usd_cents / 100).toFixed(2)}¢`}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isDeleting}
                className="ml-auto"
              >
                <Trash2 className="h-3 w-3" />
                Elimina
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Helpers UI
// ============================================================
function MetricTile({
  label,
  value,
  target,
  adherence,
  small,
}: {
  label: string
  value: string | number
  target?: number | null
  adherence?: number | null
  small?: boolean
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn(
        'mt-1 font-mono font-semibold tabular',
        small ? 'text-sm capitalize' : 'text-lg'
      )}>
        {value}
      </p>
      {target != null && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          target {target}
        </p>
      )}
      {adherence != null && (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground tabular">
          aderenza {round0(adherence)}%
        </p>
      )}
    </div>
  )
}

function WeightTile({
  weightStart,
  weightEnd,
  weightDelta,
}: {
  weightStart: number | null
  weightEnd: number | null
  weightDelta: number | null
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Peso
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular">
        {weightEnd != null ? `${weightEnd}kg` : '—'}
      </p>
      {weightDelta != null && (
        <p
          className={cn(
            'mt-0.5 inline-flex items-center gap-0.5 font-mono text-[10px] tabular',
            Math.abs(weightDelta) < 0.1
              ? 'text-muted-foreground'
              : weightDelta > 0
                ? 'text-warning'
                : 'text-primary',
          )}
        >
          {weightDelta > 0 ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : weightDelta < 0 ? (
            <TrendingDown className="h-2.5 w-2.5" />
          ) : null}
          {weightDelta > 0 ? '+' : ''}
          {weightDelta.toFixed(1)} kg
        </p>
      )}
      {weightStart != null && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          da {weightStart}kg
        </p>
      )}
    </div>
  )
}

function ChangeTile({
  label,
  current,
  proposed,
  unit,
}: {
  label: string
  current: number | null
  proposed: number | null
  unit?: string
}) {
  if (proposed == null) {
    return (
      <div className="rounded-md border border-border bg-background/50 p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">invariato</p>
        {current != null && (
          <p className="mt-0.5 font-mono text-[10px] tabular text-muted-foreground">
            {current}
            {unit && ` ${unit}`}
          </p>
        )}
      </div>
    )
  }

  const delta = current != null ? proposed - current : null
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-primary">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular">
        {proposed}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {current != null && (
        <p className="mt-0.5 font-mono text-[10px] tabular text-muted-foreground">
          da {current}
          {delta != null && (
            <span
              className={cn(
                'ml-1',
                delta > 0 ? 'text-warning' : delta < 0 ? 'text-primary' : '',
              )}
            >
              ({delta > 0 ? '+' : ''}
              {delta})
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function labelAdherence(r?: string | null): string {
  switch (r) {
    case 'good':
      return 'buona'
    case 'ok':
      return 'discreta'
    case 'poor':
      return 'scarsa'
    case 'n_a':
      return 'n/d'
    default:
      return ''
  }
}
