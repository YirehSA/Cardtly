'use client'

import { useRef, useState } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import CardVideo from './CardVideo'
import { parseVideoUrl, VIDEO_PLATFORMS } from '@/lib/card-video'

// The video section's controls, in the personal and team card editors alike
// (lib/card-video, migration 099): the switch, the link, and the title under it.
//
// A pasted link is checked with the platform (/api/video/preview) as soon as it
// is pasted or the box is left: that says whether it will play on a card at
// all, fills in the title, and stores the platform's own page for the video
// rather than whatever share link was pasted. The preview under it is the same
// component the card draws, so what is shown here is what visitors get.

export interface VideoValue {
  video_url: string
  video_title: string
  show_video: boolean
}

interface Props {
  value: VideoValue
  onChange: (next: VideoValue) => void
  /** Free plan, or a field the editor may not change. */
  disabled?: boolean
  accentHex?: string
}

export default function VideoField({ value, onChange, disabled = false, accentHex = '#3b82f6' }: Props) {
  // The latest value, for the check that finishes after a paste.
  const valueRef = useRef(value)
  valueRef.current = value
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // The link last checked, and one in flight, so a paste followed by leaving
  // the box asks once. Refs, because the paste handler's copy of state is stale.
  const checked = useRef(value.video_url)
  const inFlight = useRef<string | null>(null)

  async function check(raw: string) {
    const url = raw.trim()
    if (!url || url === checked.current || url === inFlight.current) return
    setError(null); setNote(null)
    inFlight.current = url
    setChecking(true)
    try {
      const res = await fetch('/api/video/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) { setError(data?.error || 'That link could not be checked. Try again.'); return }
      // A different video takes the platform's title; the same one, checked
      // again, keeps whatever title is there now (it may have been typed).
      const before = parseVideoUrl(checked.current)
      const after = parseVideoUrl(data.url)
      const sameVideo = !!before && !!after && before.provider === after.provider && before.id === after.id
      checked.current = data.url
      onChange({
        video_url: data.url,
        video_title: sameVideo ? valueRef.current.video_title : (data.title || ''),
        show_video: true,
      })
      if (data.warning) setNote(data.warning)
    } catch {
      setError('That link could not be checked. Check your connection and try again.')
    } finally {
      inFlight.current = null
      setChecking(false)
    }
  }

  const ready = !!parseVideoUrl(value.video_url) && !error

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium mb-1.5">Show the video on the card</p>
        <div className="flex gap-3">
          {[true, false].map(on => (
            <button key={String(on)} type="button" disabled={disabled}
              onClick={() => onChange({ ...value, show_video: on })}
              aria-pressed={value.show_video === on}
              className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${value.show_video === on ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border hover:border-foreground/20'}`}>
              {on ? 'On' : 'Off'}
            </button>
          ))}
        </div>
        {!value.show_video && value.video_url && (
          <p className="text-[11px] text-muted-foreground mt-1.5">Hidden from the card. The link is kept for when you switch it back on.</p>
        )}
      </div>

      <label className="block">
        <span className="text-xs font-medium">Video link</span>
        <div className="relative mt-1.5">
          <input type="url" inputMode="url" value={value.video_url} disabled={disabled}
            onChange={e => { setError(null); onChange({ ...value, video_url: e.target.value }) }}
            onBlur={e => check(e.target.value)}
            onPaste={e => { const t = e.clipboardData.getData('text'); if (t) setTimeout(() => check(t), 0) }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition disabled:opacity-50 disabled:cursor-not-allowed" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {checking ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              : error ? <AlertCircle className="w-4 h-4 text-red-500" />
              : ready ? <Check className="w-4 h-4 text-green-500" /> : null}
          </span>
        </div>
        <span className="block text-[11px] text-muted-foreground mt-1.5">
          One video on {VIDEO_PLATFORMS}. The picture comes from the platform; the video plays on the card.
        </span>
        {error && <span className="block text-xs text-red-500 mt-1.5">{error}</span>}
        {note && <span className="block text-xs text-amber-600 mt-1.5">{note}</span>}
      </label>

      {value.video_url && (
        <label className="block">
          <span className="text-xs font-medium">Title under the video <span className="text-muted-foreground font-normal">(optional)</span></span>
          <input value={value.video_title} disabled={disabled} maxLength={200}
            onChange={e => onChange({ ...value, video_title: e.target.value })}
            placeholder="Filled in from the platform"
            className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition disabled:opacity-50 disabled:cursor-not-allowed" />
        </label>
      )}

      {ready && (
        <div className="max-w-sm">
          <CardVideo key={value.video_url} url={value.video_url} bare accentHex={accentHex} headingColor="" captionColor="" />
        </div>
      )}
    </div>
  )
}
