// A video on a card: one link, played in its own section under the bio.
//
// Andre, 2026-11-02: "Can we add a Video Link that plays a video (YouTube +
// Vimeo and so on) ... under the bios. Not part of the bio, it must be its own
// section ... a feature that you can switch on and off. The image must be
// pulled from the platform itself."
//
// THE LINK IS THE ONLY THING STORED (cards.video_url, team_cards.video_url,
// migration 099). Everything else - which platform, the player address, the
// picture - is worked out from it here, every time. The player is an iframe on
// somebody else's site, so its address must never be something a card row can
// set: a stored embed URL would let anyone who can edit a card frame any page
// they like on cardtly.com. Only the platforms below are recognised, each by
// its own host and an id of the shape that platform uses, and the player URL is
// built from that id alone.
//
// THE PICTURE COMES FROM THE PLATFORM. YouTube and Dailymotion publish a
// thumbnail at an address derived from the id. Vimeo, Loom and Wistia say what
// it is in their oEmbed answer, so the card asks /api/video/thumb, which asks
// the platform and redirects to its picture. TikTok gives no picture any more,
// so its own player is shown, not started, and draws the cover itself.
//
// Pure: no imports, so scripts/check-card-video can run it.

export type VideoProvider = 'youtube' | 'vimeo' | 'tiktok' | 'loom' | 'wistia' | 'dailymotion'

export interface VideoRef {
  provider: VideoProvider
  id: string
  /** The platform's name, for the label on the picture. */
  label: string
  /** The video's own page on the platform. What is stored after a save. */
  watchUrl: string
  /** The player, started by the tap that loads it. */
  embedUrl: string
  /** Set when the platform gives no picture of its own and its player shows
   *  the video's cover itself: the card then shows this player, not started,
   *  instead of a picture. TikTok, whose oEmbed answer stopped carrying a
   *  thumbnail (checked 2026-11-02). */
  posterPlayerUrl: string | null
  /** TikTok and YouTube Shorts are upright; everything else is 16:9. */
  portrait: boolean
  /** Pictures at addresses derived from the id, best first. Empty when only
   *  the platform's oEmbed answer knows (see thumbsFor). */
  thumbs: string[]
  /** The platform's oEmbed address for this video: its title, and its picture. */
  oembed: string
}

/** For the editor's hint and its error message. */
export const VIDEO_PLATFORMS = 'YouTube, Vimeo, TikTok, Loom, Wistia or Dailymotion'

const LABELS: Record<VideoProvider, string> = {
  youtube: 'YouTube', vimeo: 'Vimeo', tiktok: 'TikTok', loom: 'Loom', wistia: 'Wistia', dailymotion: 'Dailymotion',
}

/** Where each platform's oEmbed picture may live. /api/video/thumb redirects
 *  only to these, so it cannot be turned into a redirect to anywhere. */
export const THUMB_HOSTS: Record<VideoProvider, RegExp> = {
  youtube: /^i\.ytimg\.com$/,
  vimeo: /^i\.vimeocdn\.com$/,
  tiktok: /(^|\.)tiktokcdn(-[a-z]+)?\.com$/,
  loom: /(^|\.)loom\.com$/,
  wistia: /(^|\.)wistia\.(com|net)$/,
  dailymotion: /(^|\.)(dailymotion\.com|dmcdn\.net)$/,
}

/** The hosts the players are served from, for the CSP's frame-src. */
export const PLAYER_ORIGINS = [
  'https://www.youtube-nocookie.com', 'https://player.vimeo.com', 'https://www.tiktok.com',
  'https://www.loom.com', 'https://fast.wistia.net', 'https://www.dailymotion.com',
] as const

function toUrl(raw: unknown): URL | null {
  const s = String(raw ?? '').trim()
  if (!s || s.length > 500 || /\s/.test(s)) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '')
const segmentsOf = (u: URL) => u.pathname.split('/').filter(Boolean)

/** YouTube's t= or start=: 90, 90s, 1m30s, 1h2m3s. 0 when absent or unreadable. */
function youtubeStart(u: URL): number {
  const raw = (u.searchParams.get('t') || u.searchParams.get('start') || '').trim().toLowerCase()
  if (!raw) return 0
  if (/^\d+s?$/.test(raw)) return parseInt(raw, 10)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw)
  if (!m || !m[0]) return 0
  return (parseInt(m[1] || '0', 10) * 3600) + (parseInt(m[2] || '0', 10) * 60) + parseInt(m[3] || '0', 10)
}

function ref(provider: VideoProvider, id: string, watchUrl: string, embedUrl: string, portrait: boolean, thumbs: string[], oembed: string, posterPlayerUrl: string | null = null): VideoRef {
  return { provider, id, label: LABELS[provider], watchUrl, embedUrl, posterPlayerUrl, portrait, thumbs, oembed }
}

function youtube(u: URL, host: string): VideoRef | null {
  const seg = segmentsOf(u)
  let id = ''
  let shorts = false
  if (host === 'youtu.be') id = seg[0] || ''
  else if (seg[0] === 'watch') id = u.searchParams.get('v') || ''
  else if (seg[0] === 'shorts') { id = seg[1] || ''; shorts = true }
  else if (seg[0] === 'embed' || seg[0] === 'live' || seg[0] === 'v') id = seg[1] || ''
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null
  const start = youtubeStart(u)
  const watchUrl = shorts ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`
  return ref('youtube', id, watchUrl,
    `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0${start ? `&start=${start}` : ''}`,
    shorts,
    // maxresdefault is missing on older and smaller uploads; hqdefault never is.
    [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`)
}

function vimeo(u: URL, host: string): VideoRef | null {
  const seg = segmentsOf(u)
  // player.vimeo.com/video/ID?h=HASH, vimeo.com/ID, vimeo.com/ID/HASH (an
  // unlisted video, which needs its hash to play), and the channel, group and
  // showcase pages, all of which end in the id.
  const at = seg.findIndex(s => /^\d{5,12}$/.test(s))
  if (at < 0) return null
  if (host === 'player.vimeo.com' && seg[0] !== 'video') return null
  const id = seg[at]
  const next = seg[at + 1] || ''
  const hash = /^[0-9a-f]{6,20}$/i.test(next) ? next : (/^[0-9a-f]{6,20}$/i.test(u.searchParams.get('h') || '') ? u.searchParams.get('h')! : '')
  const watchUrl = `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`
  return ref('vimeo', id, watchUrl,
    `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ''}autoplay=1&playsinline=1&dnt=1`,
    false, [],
    `https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(watchUrl)}`)
}

function tiktok(u: URL): VideoRef | null {
  const seg = segmentsOf(u)
  // tiktok.com/@user/video/ID, /v/ID.html, /embed/v2/ID, /player/v1/ID.
  let id = ''
  let user = ''
  if (seg[0]?.startsWith('@') && seg[1] === 'video') { user = seg[0].slice(1); id = seg[2] || '' }
  else if (seg[0] === 'v') id = (seg[1] || '').replace(/\.html$/, '')
  else if (seg[0] === 'embed' && seg[1] === 'v2') id = seg[2] || ''
  else if (seg[0] === 'player' && seg[1] === 'v1') id = seg[2] || ''
  if (!/^\d{15,22}$/.test(id)) return null
  if (user && !/^[A-Za-z0-9._]{1,40}$/.test(user)) user = ''
  const watchUrl = `https://www.tiktok.com/@${user || 'tiktok'}/video/${id}`
  // timestamp=0 drops the "00:00/00:28" readout from the player's control row.
  // With it there, the row runs past a player narrower than about 240px and
  // the fullscreen button is cut off; the card shows TikTok at about 200px.
  return ref('tiktok', id, watchUrl,
    `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0&timestamp=0`,
    true, [],
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(watchUrl)}`,
    `https://www.tiktok.com/player/v1/${id}?autoplay=0&rel=0&timestamp=0`)
}

function loom(u: URL): VideoRef | null {
  const seg = segmentsOf(u)
  if (seg[0] !== 'share' && seg[0] !== 'embed') return null
  const id = (seg[1] || '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(id)) return null
  const watchUrl = `https://www.loom.com/share/${id}`
  return ref('loom', id, watchUrl, `https://www.loom.com/embed/${id}?autoplay=1`, false, [],
    `https://www.loom.com/v1/oembed?url=${encodeURIComponent(watchUrl)}`)
}

function wistia(u: URL): VideoRef | null {
  const seg = segmentsOf(u)
  // ACCOUNT.wistia.com/medias/ID, fast.wistia.net/embed/iframe/ID,
  // fast.wistia.com/embed/medias/ID, wi.st/medias/ID.
  let id = ''
  if (seg[0] === 'medias') id = seg[1] || ''
  else if (seg[0] === 'embed' && (seg[1] === 'iframe' || seg[1] === 'medias')) id = (seg[2] || '').replace(/\.jsonp?$/, '')
  if (!/^[a-z0-9]{10}$/.test(id)) return null
  // Wistia has no public watch page; its player is the page.
  const watchUrl = `https://fast.wistia.net/embed/iframe/${id}`
  return ref('wistia', id, watchUrl, `${watchUrl}?autoPlay=true&playsinline=true`, false, [],
    `https://fast.wistia.com/oembed?url=${encodeURIComponent(watchUrl)}`)
}

function dailymotion(u: URL, host: string): VideoRef | null {
  const seg = segmentsOf(u)
  let id = ''
  if (host === 'dai.ly') id = seg[0] || ''
  else if (seg[0] === 'video') id = seg[1] || ''
  else if (seg[0] === 'embed' && seg[1] === 'video') id = seg[2] || ''
  else if (host === 'geo.dailymotion.com') id = u.searchParams.get('video') || ''
  // Old links carry the title after the id: /video/x7tgad0_my-title.
  id = id.split('_')[0]
  if (!/^[a-zA-Z0-9]{5,12}$/.test(id)) return null
  const watchUrl = `https://www.dailymotion.com/video/${id}`
  return ref('dailymotion', id, watchUrl, `https://www.dailymotion.com/embed/video/${id}?autoplay=1`, false,
    [`https://www.dailymotion.com/thumbnail/video/${id}`],
    `https://www.dailymotion.com/services/oembed?format=json&url=${encodeURIComponent(watchUrl)}`)
}

/** The video a link points at, or null when it is not one of ours. */
export function parseVideoUrl(raw: unknown): VideoRef | null {
  const u = toUrl(raw)
  if (!u) return null
  const host = hostOf(u)
  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') return youtube(u, host)
  if (host === 'vimeo.com' || host === 'player.vimeo.com') return vimeo(u, host)
  if (host === 'tiktok.com') return tiktok(u)
  if (host === 'loom.com') return loom(u)
  if (/(^|\.)wistia\.(com|net)$/.test(host) || host === 'wi.st' || host.endsWith('.wi.st')) return wistia(u)
  if (host === 'dailymotion.com' || host === 'geo.dailymotion.com' || host === 'dai.ly') return dailymotion(u, host)
  return null
}

/** A share link that only says where the video is once it is followed:
 *  vm.tiktok.com/abc, vt.tiktok.com/abc, tiktok.com/t/abc. The editor's
 *  lookup follows it (to TikTok only) and stores where it lands. */
export function isShortVideoLink(raw: unknown): boolean {
  const u = toUrl(raw)
  if (!u) return false
  const host = u.hostname.toLowerCase()
  return host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || (hostOf(u) === 'tiktok.com' && segmentsOf(u)[0] === 't')
}

/** May a short link's redirect be followed to this address? TikTok only. */
export function isTikTokAddress(raw: unknown): boolean {
  const u = toUrl(raw)
  return !!u && u.protocol === 'https:' && /(^|\.)tiktok\.com$/.test(u.hostname.toLowerCase())
}

/** The pictures to try, best first: the platform's own addresses, or the one
 *  /api/video/thumb finds by asking it. */
export function thumbsFor(v: VideoRef): string[] {
  return v.thumbs.length ? v.thumbs : [`/api/video/thumb?u=${encodeURIComponent(v.watchUrl)}`]
}

/** May /api/video/thumb send a visitor to this picture? https, on the
 *  platform's own image host. */
export function isPlatformThumb(provider: VideoProvider, raw: unknown): boolean {
  const u = toUrl(raw)
  return !!u && u.protocol === 'https:' && THUMB_HOSTS[provider].test(u.hostname.toLowerCase())
}
