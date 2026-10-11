/** Parse exercise demo URLs (YouTube, Vimeo, MP4, GIF, image). */

import gifFallbacks from '@/data/exercise-demo-gifs.json'

const GIF_MAP = gifFallbacks as Record<string, string>

export type ExerciseMediaKind =
  | 'youtube'
  | 'vimeo'
  | 'video'
  | 'gif'
  | 'image'
  | 'link'

export type ExerciseMedia = {
  kind: ExerciseMediaKind
  /** Source for <video>/<img>, or original URL for link */
  src: string
  /** Embed URL for iframe providers */
  embedUrl?: string
}

export function youtubeSearchUrl(exerciseName: string): string {
  const q = `${exerciseName} esercizio tecnica`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/**
 * URL demo effettivo: link salvato dall'utente, altrimenti GIF del
 * catalogo ExerciseDB mappata su nome/alias (es. Lat machine).
 */
export function resolveExerciseDemoUrl(opts: {
  videoUrl?: string | null
  name: string
  aliases?: string[] | null
}): string | null {
  const saved = opts.videoUrl?.trim()
  if (saved) return saved

  const keys = [opts.name, ...(opts.aliases ?? [])]
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean)

  for (const k of keys) {
    if (GIF_MAP[k]) return GIF_MAP[k]
  }

  // Match parziale solo per chiavi corte/stabili (es. "lat machine")
  for (const k of keys) {
    for (const [mapKey, url] of Object.entries(GIF_MAP)) {
      if (mapKey.length < 6) continue
      if (k.includes(mapKey) || mapKey.includes(k)) return url
    }
  }

  return null
}

export function parseExerciseMedia(raw: string | null | undefined): ExerciseMedia | null {
  if (!raw) return null
  const url = raw.trim()
  if (!url) return null

  const yt = extractYoutubeId(url)
  if (yt) {
    return {
      kind: 'youtube',
      src: url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1`,
    }
  }

  const vimeo = extractVimeoId(url)
  if (vimeo) {
    return {
      kind: 'vimeo',
      src: url,
      embedUrl: `https://player.vimeo.com/video/${vimeo}`,
    }
  }

  const lower = url.toLowerCase().split('?')[0] ?? url.toLowerCase()
  if (/\.(gif)(\s|$)/.test(lower) || lower.endsWith('.gif')) {
    return { kind: 'gif', src: url }
  }
  if (/\.(mp4|webm|mov)(\s|$)/.test(lower) || /\.(mp4|webm|mov)$/.test(lower)) {
    return { kind: 'video', src: url }
  }
  if (/\.(png|jpe?g|webp)(\s|$)/.test(lower) || /\.(png|jpe?g|webp)$/.test(lower)) {
    return { kind: 'image', src: url }
  }

  // Unknown https link — open externally
  if (/^https?:\/\//i.test(url)) {
    return { kind: 'link', src: url }
  }

  return null
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v')
        return id && /^[\w-]{11}$/.test(id) ? id : null
      }
      const parts = u.pathname.split('/').filter(Boolean)
      // /embed/ID, /shorts/ID, /live/ID
      if (
        parts[0] &&
        ['embed', 'shorts', 'live', 'v'].includes(parts[0]) &&
        parts[1] &&
        /^[\w-]{11}$/.test(parts[1])
      ) {
        return parts[1]
      }
    }
  } catch {
    // bare ID
    if (/^[\w-]{11}$/.test(url.trim())) return url.trim()
  }
  return null
}

function extractVimeoId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = parts[0] === 'video' ? parts[1] : parts[0]
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}
