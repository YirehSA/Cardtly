'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PlayCircle, X } from 'lucide-react'
import { useIosApp } from '@/components/dashboard/PlatformProvider'
import { getNativePlatform } from '@/lib/capacitor'
import {
  howToVideo, howToForPage, howToGroups, canShow, playerUrl, lengthLabel, GROUP_TITLES, HOWTO_VIDEOS,
  type HowToVideo, type Who,
} from '@/lib/howto-videos'

// The how-to videos in the app: a pop-up player, the "Watch how" bar a page
// shows above itself, and the How-to page's library. Which video may show
// where is decided in lib/howto-videos (canShow), never here.

function useAndroidApp(): boolean {
  // Capacitor answers only in the browser, after the page has loaded. Only the
  // Android-app-only video (tap to share) waits on it.
  const [android, setAndroid] = useState(false)
  useEffect(() => { setAndroid(getNativePlatform() === 'android') }, [])
  return android
}

export function HowToPlayer({ video, onClose }: { video: HowToVideo; onClose: () => void }) {
  // A phone held upright gets the 9:16 cut; everything else the 16:9 one.
  const [portrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px) and (orientation: portrait)').matches)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85" role="dialog" aria-modal="true"
      aria-label={video.title} onClick={onClose}>
      <div className={portrait ? 'w-full max-w-[min(100%,calc(80vh*9/16))]' : 'w-full max-w-4xl'} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-white truncate">{video.title}</p>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: portrait ? '9 / 16' : '16 / 9' }}>
          <iframe src={playerUrl(portrait ? video.portrait : video.landscape)} title={video.title}
            className="absolute inset-0 w-full h-full border-0" loading="lazy"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      </div>
    </div>
  )
}

/** Buttons for one or more videos. Shows nothing when none may play here.
 *  "site" is for the dark marketing pages, which do not use the dashboard's colours. */
export function WatchHow({ videos, pathname, variant = 'app', className = 'mb-5' }: {
  videos: string[]; pathname: string; variant?: 'app' | 'site'; className?: string
}) {
  const iosApp = useIosApp()
  const androidApp = useAndroidApp()
  const [open, setOpen] = useState<HowToVideo | null>(null)
  const list = videos.map(howToVideo).filter((v): v is HowToVideo => !!v && canShow(v, { pathname, iosApp, androidApp }))
  if (!list.length) return null
  const site = variant === 'site'
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} data-howto>
      <span className={`text-xs font-semibold inline-flex items-center gap-1.5 ${site ? '' : 'text-muted-foreground'}`}
        style={site ? { color: 'rgba(255,255,255,0.6)' } : undefined}>
        <PlayCircle className="w-4 h-4" style={{ color: site ? '#00d4ff' : 'hsl(var(--accent))' }} />Watch how
      </span>
      {list.map(v => (
        <button key={v.n} onClick={() => setOpen(v)}
          className={site
            ? 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white transition hover:bg-white/10'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted transition'}
          style={site ? { border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)' } : undefined}>
          {v.title}
          <span className={`tabular-nums ${site ? '' : 'text-muted-foreground'}`} style={site ? { color: 'rgba(255,255,255,0.55)' } : undefined}>
            {lengthLabel(v.seconds)}
          </span>
        </button>
      ))}
      {open && <HowToPlayer video={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** The bar above every dashboard page, from the page's address. */
export function PageHowTo({ who }: { who: Who }) {
  const pathname = usePathname() || ''
  const videos = howToForPage(pathname, who)
  if (!videos.length) return null
  return <WatchHow videos={videos} pathname={pathname} />
}

/** The How-to page: every video this person can use, their role's first. */
export function HowToLibrary({ who }: { who: Who }) {
  const iosApp = useIosApp()
  const androidApp = useAndroidApp()
  const [open, setOpen] = useState<HowToVideo | null>(null)
  const groups = howToGroups(who)
    .map(g => ({ g, videos: HOWTO_VIDEOS.filter(v => v.group === g && canShow(v, { pathname: null, iosApp, androidApp })) }))
    .filter(x => x.videos.length)

  return (
    <div className="space-y-8">
      {groups.map(({ g, videos }) => (
        <section key={g}>
          <h2 className="font-semibold text-sm mb-3">{GROUP_TITLES[g]}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map(v => (
              <button key={v.n} onClick={() => setOpen(v)}
                className="group text-left bg-card border border-border rounded-lg overflow-hidden hover:border-[hsl(var(--accent))] transition">
                <div className="relative aspect-video bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/howto/${v.n}.jpg`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/25 transition">
                    <PlayCircle className="w-11 h-11 text-white drop-shadow-lg opacity-90" />
                  </span>
                  <span className="absolute bottom-2 right-2 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded bg-black/70 text-white">
                    {lengthLabel(v.seconds)}
                  </span>
                </div>
                <p className="p-3 text-sm font-medium leading-snug">{v.title}</p>
              </button>
            ))}
          </div>
        </section>
      ))}
      {open && <HowToPlayer video={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
