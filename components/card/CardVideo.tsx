'use client'

import { useMemo, useState } from 'react'
import { parseVideoUrl, thumbsFor } from '@/lib/card-video'
import { getReadableTextOn } from '@/types/design'

// The card's video section: the platform's picture with a play button, and the
// platform's player in its place once tapped (lib/card-video). TikTok, which
// gives no picture, shows its own player from the start instead.
//
// The player is not loaded until then. A YouTube or TikTok player is a large
// page of its own, and loading it with the card would slow every card down for
// the visitors who never press play, and hand those platforms a visit from
// everyone who opened it. The picture is one image.
//
// Renders nothing for a link it does not recognise, so a bad value in a card
// row leaves the card exactly as it was.

interface Props {
  url: string
  /** The video's title, filled in from the platform when the link was saved,
   *  shown under it like a gallery caption. */
  title?: string | null
  accentHex: string
  headingColor: string
  captionColor: string
  /** How the heading and caption are set: centred on the centred templates. */
  align?: 'left' | 'center'
  /** The space around it, which is each template's own. */
  style?: React.CSSProperties
  /** The editor's preview: no heading, the picture only. */
  bare?: boolean
}

export default function CardVideo({ url, title, accentHex, headingColor, captionColor, align = 'left', style, bare = false }: Props) {
  const video = useMemo(() => parseVideoUrl(url), [url])
  const [playing, setPlaying] = useState(false)
  // Which of the platform's pictures is showing. Past the last one, none is,
  // and the frame stays plain behind the play button.
  const [pick, setPick] = useState(0)
  if (!video) return null

  const thumbs = thumbsFor(video)
  const thumb = thumbs[pick]
  const name = title?.trim() || `${video.label} video`
  const box: React.CSSProperties = video.portrait
    ? { aspectRatio: '9 / 16', maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }
    : { aspectRatio: '16 / 9' }

  return (
    <section style={style} aria-label="Video">
      {!bare && (
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: headingColor, textAlign: align }}>Video</p>
      )}
      <div className="relative w-full overflow-hidden rounded-xl" style={{ ...box, background: '#000' }}>
        {playing || video.posterPlayerUrl ? (
          <iframe
            // TikTok gives no picture, so its player is shown from the start,
            // not playing, drawing the cover itself; lazy, so it only loads as
            // the visitor scrolls to it (lib/card-video posterPlayerUrl).
            src={playing ? video.embedUrl : video.posterPlayerUrl!}
            loading={playing ? undefined : 'lazy'}
            title={name}
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            // YouTube refuses to play for a page that sends no referrer.
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full cursor-pointer group"
            aria-label={`Play ${name} (${video.label})`}>
            {thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" loading="lazy" decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-[1.02]"
                onError={() => setPick(p => p + 1)}
                // YouTube answers a missing maxresdefault with a 120 x 90 grey
                // placeholder rather than an error, so that counts as missing.
                onLoad={e => { if (e.currentTarget.naturalWidth <= 120 && pick < thumbs.length - 1) setPick(p => p + 1) }} />
            )}
            <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.05) 55%)' }} />
            <span aria-hidden className="absolute inset-0 grid place-items-center">
              <span className="w-16 h-16 rounded-full grid place-items-center transition group-hover:scale-110 group-active:scale-95"
                style={{ background: accentHex, color: getReadableTextOn(accentHex), boxShadow: `0 8px 28px ${accentHex}66, 0 2px 8px rgba(0,0,0,0.35)` }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.4-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5z" /></svg>
              </span>
            </span>
            <span aria-hidden className="absolute left-3 bottom-3 text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>{video.label}</span>
          </button>
        )}
      </div>
      {!bare && title?.trim() && (
        <p className="mt-2 text-[12px] leading-snug" style={{ color: captionColor, textAlign: align }}>{title.trim()}</p>
      )}
    </section>
  )
}
