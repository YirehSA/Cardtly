import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseVideoUrl, isShortVideoLink, isTikTokAddress, thumbsFor, isPlatformThumb, VIDEO_PLATFORMS } from '@/lib/card-video'

// The card editor's check on a video link (lib/card-video), before it is saved.
//
// Says which platform it is, asks the platform for the title and picture, and
// returns the link to store: the platform's own page for the video, however it
// was pasted. A TikTok share link (vm.tiktok.com/...) only says where the video
// is once followed, so it is followed here, to TikTok and nowhere else.
//
// Signed in only: it fetches from other sites on request, and only people
// editing a card have a reason to ask.

export const runtime = 'nodejs'

const TIMEOUT_MS = 6000

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cardtly/1.0; +https://www.cardtly.com)', ...(init.headers || {}) } })
  } finally {
    clearTimeout(timer)
  }
}

/** Follow a TikTok share link to the video it stands for. Three hops at most,
 *  and every one must stay on tiktok.com. */
async function resolveShortLink(raw: string): Promise<string | null> {
  let at = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`
  for (let hop = 0; hop < 3; hop++) {
    if (!isTikTokAddress(at)) return null
    const res = await fetchWithTimeout(at, { redirect: 'manual' }).catch(() => null)
    const next = res?.headers.get('location')
    if (!next) return null
    at = new URL(next, at).toString()
    if (parseVideoUrl(at)) return at
  }
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  let raw = String(body?.url ?? '').trim().slice(0, 500)
  if (!raw) return NextResponse.json({ error: 'Paste a link to the video.' }, { status: 400 })

  if (!parseVideoUrl(raw) && isShortVideoLink(raw)) {
    raw = (await resolveShortLink(raw)) || raw
  }
  const ref = parseVideoUrl(raw)
  if (!ref) {
    return NextResponse.json({ error: `That is not a video link we can play. Paste the link to one video on ${VIDEO_PLATFORMS}.` }, { status: 400 })
  }

  // The platform's own answer: the title, the picture, and whether it will play
  // on another site at all. YouTube says 401 for a video whose owner turned
  // embedding off, 404 for a private one and 400 for one that does not exist;
  // Vimeo says 403 for one limited to certain sites and 404 for a missing one.
  // Each would show a player that refuses to play, so say so now. The oEmbed
  // address is built by lib/card-video, so a 400 is about the video, not us.
  let title: string | null = null
  let thumb: string | null = thumbsFor(ref)[0]
  let warning: string | undefined
  try {
    const res = await fetchWithTimeout(ref.oembed)
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
      return NextResponse.json({
        error: `${ref.label} says this video is private, deleted, or not allowed to play on other sites. Check its sharing settings on ${ref.label}, or use another video.`,
      }, { status: 422 })
    }
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (typeof data?.title === 'string') title = data.title.trim().slice(0, 200) || null
      if (!ref.thumbs.length && isPlatformThumb(ref.provider, data?.thumbnail_url)) thumb = data.thumbnail_url
    } else {
      warning = `${ref.label} did not answer just now, so the title could not be filled in. The video will still play.`
    }
  } catch {
    warning = `${ref.label} did not answer just now, so the title could not be filled in. The video will still play.`
  }

  return NextResponse.json({
    url: ref.watchUrl,
    provider: ref.provider,
    label: ref.label,
    portrait: ref.portrait,
    title,
    thumb,
    ...(warning ? { warning } : {}),
  })
}
