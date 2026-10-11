import { ExternalLink, PlayCircle } from 'lucide-react'
import {
  parseExerciseMedia,
  resolveExerciseDemoUrl,
  youtubeSearchUrl,
} from '@/lib/exercise-media'

type Props = {
  exerciseName: string
  aliases?: string[] | null
  videoUrl: string | null | undefined
  className?: string
}

export function ExerciseDemo({
  exerciseName,
  aliases,
  videoUrl,
  className,
}: Props) {
  const resolved = resolveExerciseDemoUrl({
    videoUrl,
    name: exerciseName,
    aliases,
  })
  const media = parseExerciseMedia(resolved)
  const fromCatalog = Boolean(resolved && !videoUrl?.trim())

  if (!media) {
    return (
      <div
        className={
          className ??
          'flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-background/50 px-4 py-8 text-center'
        }
      >
        <PlayCircle className="h-8 w-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Nessuna demo collegata</p>
          <p className="text-xs text-muted-foreground">
            Incolla sotto un link YouTube, GIF o MP4, oppure cerca una tecnica
            su YouTube.
          </p>
        </div>
        <a
          href={youtubeSearchUrl(exerciseName)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Cerca “{exerciseName}” su YouTube
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {media.kind === 'youtube' || media.kind === 'vimeo' ? (
        <div
          className={
            className ??
            'overflow-hidden rounded-md border border-border bg-black'
          }
        >
          <div className="relative aspect-video w-full">
            <iframe
              title={`Demo: ${exerciseName}`}
              src={media.embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : media.kind === 'video' ? (
        <div
          className={
            className ??
            'overflow-hidden rounded-md border border-border bg-black'
          }
        >
          <video
            src={media.src}
            controls
            playsInline
            loop
            muted
            autoPlay
            preload="metadata"
            className="aspect-video w-full"
          >
            Il tuo browser non riproduce questo video.
          </video>
        </div>
      ) : media.kind === 'gif' || media.kind === 'image' ? (
        <div
          className={
            className ??
            'overflow-hidden rounded-md border border-border bg-background'
          }
        >
          <img
            src={media.src}
            alt={`Demo: ${exerciseName}`}
            className="mx-auto max-h-80 w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : (
        <a
          href={media.src}
          target="_blank"
          rel="noopener noreferrer"
          className={
            className ??
            'flex items-center justify-center gap-2 rounded-md border border-border bg-background/50 px-4 py-6 text-sm text-primary hover:underline'
          }
        >
          Apri demo
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {fromCatalog && (
        <p className="text-[10px] text-muted-foreground">
          GIF tecnica dal catalogo ExerciseDB (uso personale). Puoi sostituirla
          con un tuo link sotto.
        </p>
      )}
    </div>
  )
}

/** Small affordance: play icon when a playable URL exists. */
export function DemoBadge({ hasDemo }: { hasDemo: boolean }) {
  if (!hasDemo) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-primary"
      title="Demo disponibile"
    >
      <PlayCircle className="h-3 w-3" />
      Demo
    </span>
  )
}
