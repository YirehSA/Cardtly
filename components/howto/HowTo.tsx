'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Play, PlayCircle, X, ChevronDown, Search } from 'lucide-react'
import { useIosApp } from '@/components/dashboard/PlatformProvider'
import { getNativePlatform } from '@/lib/capacitor'
import {
  howToVideo, howToForPage, canShow, playerUrl, lengthLabel, matches, startHere, GROUP_TITLES, HOWTO_GROUPS, HOWTO_VIDEOS,
  type HowToVideo, type HowToGroup, type Who,
} from '@/lib/howto-videos'

// The how-to videos in the app: a pop-up player, the "Watch how" button a page
// shows above itself, and the How-to page. Which video may show where is
// decided in lib/howto-videos (canShow), never here.

const accent = 'hsl(var(--accent))'

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true"
      aria-label={video.title} onClick={onClose}>
      <div className={portrait ? 'w-full max-w-[min(100%,calc(78vh*9/16))]' : 'w-full max-w-4xl'} onClick={e => e.stopPropagation()}>
        <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10" style={{ aspectRatio: portrait ? '9 / 16' : '16 / 9' }}>
          <iframe src={playerUrl(portrait ? video.portrait : video.landscape)} title={video.title}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{video.title}</p>
            <p className="text-xs text-white/50">{GROUP_TITLES[video.group]} · {lengthLabel(video.seconds)}</p>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/15 transition shrink-0">
            <X className="w-4 h-4" />Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Thumb({ v, className = '' }: { v: HowToVideo; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/howto/${v.n}.jpg`} alt="" loading="lazy" className={`object-cover bg-muted ${className}`} />
  )
}

/** One button for a page's videos: a single video plays straight away, several open a short list.
 *  "site" is for the dark marketing pages, which do not use the dashboard's colours. Shows nothing when no
 *  video may play here. */
export function WatchHow({ videos, pathname, variant = 'app', className = '' }: {
  videos: string[]; pathname: string; variant?: 'app' | 'site'; className?: string
}) {
  const iosApp = useIosApp()
  const androidApp = useAndroidApp()
  const [open, setOpen] = useState<HowToVideo | null>(null)
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = videos.map(howToVideo).filter((v): v is HowToVideo => !!v && canShow(v, { pathname, iosApp, androidApp }))

  useEffect(() => {
    if (!menu) return
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [menu])

  if (!list.length) return null
  const site = variant === 'site'
  const one = list.length === 1 ? list[0] : null

  return (
    <div ref={box} className={`relative ${className}`} data-howto>
      <button onClick={() => (one ? setOpen(one) : setMenu(m => !m))} aria-expanded={one ? undefined : menu}
        className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition max-w-full ${site ? 'text-white hover:bg-white/10' : 'hover:opacity-90'}`}
        style={site
          ? { border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)' }
          : { background: 'hsl(var(--accent) / 0.12)', color: accent, boxShadow: 'inset 0 0 0 1px hsl(var(--accent) / 0.25)' }}>
        <span className="grid place-items-center w-6 h-6 rounded-full shrink-0" style={{ background: site ? '#00d4ff' : accent }}>
          <Play className="w-3 h-3 text-white fill-white ml-px" />
        </span>
        <span className="truncate">
          Watch how<span className="font-medium opacity-80"> · {one ? one.title : `${list.length} videos`}</span>
        </span>
        {one
          ? <span className="tabular-nums font-medium opacity-60 shrink-0">{lengthLabel(one.seconds)}</span>
          : <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${menu ? 'rotate-180' : ''}`} />}
      </button>

      {menu && !one && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card shadow-2xl p-1.5" role="menu">
          {list.map(v => (
            <button key={v.n} role="menuitem" onClick={() => { setMenu(false); setOpen(v) }}
              className="w-full flex items-center gap-3 p-1.5 rounded-lg text-left hover:bg-muted transition">
              <span className="relative shrink-0">
                <Thumb v={v} className="w-24 aspect-video rounded-md" />
                <span className="absolute bottom-1 right-1 text-[10px] font-semibold tabular-nums px-1 rounded bg-black/75 text-white">{lengthLabel(v.seconds)}</span>
              </span>
              <span className="text-sm font-medium leading-snug line-clamp-2">{v.title}</span>
            </button>
          ))}
        </div>
      )}
      {open && <HowToPlayer video={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** The button above every dashboard page, from the page's address, on the right. */
export function PageHowTo({ who }: { who: Who }) {
  const pathname = usePathname() || ''
  const videos = howToForPage(pathname, who)
  if (!videos.length) return null
  return (
    <div className="flex justify-end mb-3">
      <WatchHow videos={videos} pathname={pathname} />
    </div>
  )
}

function VideoCard({ v, onPlay, big = false }: { v: HowToVideo; onPlay: (v: HowToVideo) => void; big?: boolean }) {
  return (
    <button onClick={() => onPlay(v)} className="group text-left flex flex-col justify-start">
      <span className="relative block rounded-xl overflow-hidden ring-1 ring-border group-hover:ring-2 transition">
        <Thumb v={v} className="w-full aspect-video transition duration-300 group-hover:scale-[1.03]" />
        <span className="absolute left-2 bottom-2 grid place-items-center w-8 h-8 rounded-full shadow-lg transition group-hover:scale-110"
          style={{ background: accent }}>
          <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
        </span>
        <span className="absolute right-2 bottom-2 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-black/75 text-white">
          {lengthLabel(v.seconds)}
        </span>
      </span>
      <span className={`block mt-2 font-medium leading-snug line-clamp-2 group-hover:underline underline-offset-2 ${big ? 'text-sm sm:text-base' : 'text-sm'}`}>
        {v.title}
      </span>
    </button>
  )
}

/** The How-to page: search, topics, and "Start here" for this person's role. */
export function HowToLibrary({ who }: { who: Who }) {
  const iosApp = useIosApp()
  const androidApp = useAndroidApp()
  const [open, setOpen] = useState<HowToVideo | null>(null)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState<HowToGroup | 'all'>('all')

  const shown = useMemo(() => HOWTO_VIDEOS.filter(v => HOWTO_GROUPS.includes(v.group) && canShow(v, { pathname: null, iosApp, androidApp })),
    [iosApp, androidApp])
  const topics = HOWTO_GROUPS.map(g => ({ g, count: shown.filter(v => v.group === g).length })).filter(t => t.count)
  const first = startHere(who).map(n => shown.find(v => v.n === n)).filter((v): v is HowToVideo => !!v)
  const q = query.trim()
  const found = q ? shown.filter(v => matches(v, q)) : null
  const pill = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${on ? 'text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="relative block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={query} onChange={e => setQuery(e.target.value)} type="search"
            placeholder="Search, for example QR code, invite or NFC"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        {!q && (
          <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1 -mx-1 px-1">
            <button onClick={() => setTopic('all')} className={pill(topic === 'all')} style={topic === 'all' ? { background: accent } : undefined}>
              All <span className="opacity-70 tabular-nums">{shown.length}</span>
            </button>
            {topics.map(({ g, count }) => (
              <button key={g} onClick={() => setTopic(g)} className={pill(topic === g)} style={topic === g ? { background: accent } : undefined}>
                {GROUP_TITLES[g]} <span className="opacity-70 tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {found ? (
        found.length ? (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{found.length} video{found.length === 1 ? '' : 's'}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">{found.map(v => <VideoCard key={v.n} v={v} onPlay={setOpen} />)}</div>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">No video for &ldquo;{q}&rdquo;. Try another word, or pick a topic.</p>
        )
      ) : (
        <>
          {topic === 'all' && first.length > 0 && (
            <section className="rounded-2xl border border-border p-4 sm:p-5" style={{ background: 'hsl(var(--accent) / 0.06)' }}>
              <h2 className="font-semibold mb-0.5 flex items-center gap-2"><PlayCircle className="w-4 h-4" style={{ color: accent }} />Start here</h2>
              <p className="text-xs text-muted-foreground mb-4">The first videos to watch.</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">{first.map(v => <VideoCard key={v.n} v={v} onPlay={setOpen} big />)}</div>
            </section>
          )}
          {topics.filter(t => topic === 'all' || t.g === topic).map(({ g }) => (
            <section key={g}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{GROUP_TITLES[g]}</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
                {shown.filter(v => v.group === g).map(v => <VideoCard key={v.n} v={v} onPlay={setOpen} />)}
              </div>
            </section>
          ))}
        </>
      )}
      {open && <HowToPlayer video={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
