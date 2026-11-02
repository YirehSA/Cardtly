import { NextResponse } from 'next/server'
import { parseVideoUrl, isPlatformThumb } from '@/lib/card-video'

// A card video's picture, from the platform it plays on (lib/card-video).
//
// For Vimeo, Loom and Wistia only the platform's oEmbed answer says where the
// picture is, so this asks and redirects there. YouTube and Dailymotion have
// fixed addresses and are sent straight on. TikTok's answer carries no picture
// now (the card shows its player instead), but should it come back its
// pictures are signed and expire, so its answer is kept for an hour, not six.
//
// Public, because every visitor's browser asks for it. It is safe to be: it
// only reads a video link we recognise, only asks that platform's own oEmbed
// address, and only redirects to that platform's own image host. The CDN keeps
// the answer, so one card being viewed a thousand times asks once.

export const runtime = 'nodejs'

function miss() {
  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' } })
}

export async function GET(request: Request) {
  const ref = parseVideoUrl(new URL(request.url).searchParams.get('u'))
  if (!ref) return miss()

  let picture: string | null = ref.thumbs[0] || null
  if (!picture) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    try {
      const res = await fetch(ref.oembed, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cardtly/1.0; +https://www.cardtly.com)' } })
      const data = res.ok ? await res.json().catch(() => null) : null
      if (isPlatformThumb(ref.provider, data?.thumbnail_url)) picture = data.thumbnail_url
    } catch {
      /* no picture: the card shows its plain frame */
    } finally {
      clearTimeout(timer)
    }
  }
  if (!picture) return miss()

  const keep = ref.provider === 'tiktok'
    ? 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=1800'
    : 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400'
  return NextResponse.redirect(picture, { status: 302, headers: { 'Cache-Control': keep } })
}
