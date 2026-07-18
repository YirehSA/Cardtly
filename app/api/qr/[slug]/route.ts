import QRCode from 'qrcode'

export const runtime = 'nodejs'

// A QR code for a card, served by us.
//
// Email signatures used to embed a QR from api.qrserver.com, a free third
// party. That put a permanent dependency inside every email a customer has
// ever sent: if that service disappears, rate-limits us, or simply changes,
// every signature in the wild shows a broken image, and there is no way to
// reach back into sent mail and fix it. It also told a third party the card
// URL every time one of those emails was opened.
//
// This encodes the same ?s=qr marker the downloadable QR uses, so a scan from
// an email signature is attributed as a scan rather than a plain visit.

const MAX = 600
const DEFAULT_SIZE = 240
const MIN = 60

function clampSize(raw: string | null): number {
  // Number(null) and Number('') are 0, not NaN, so an absent size would clamp
  // to the minimum and quietly serve a 60px code instead of the default.
  if (!raw) return DEFAULT_SIZE
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_SIZE
  return Math.min(MAX, Math.max(MIN, Math.round(n)))
}

// Hex only, so nothing user-supplied reaches the renderer as arbitrary text.
function colour(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  const v = raw.replace(/^#/, '')
  return /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : fallback
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  // The slug only ever goes into a URL string we build ourselves - nothing is
  // fetched - but keep it to the shape a slug can actually be.
  if (!slug || !/^[a-z0-9-]{1,120}$/i.test(slug)) {
    return new Response('bad slug', { status: 400 })
  }

  const url = new URL(request.url)
  const size = clampSize(url.searchParams.get('size'))
  const dark = colour(url.searchParams.get('dark'), '#111827')
  const light = colour(url.searchParams.get('light'), '#ffffff')

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
  const target = `${base.replace(/\/$/, '')}/card/${slug}?s=qr`

  try {
    const png = await QRCode.toBuffer(target, {
      width: size,
      margin: 2,
      // A signature QR is small and often printed badly by mail clients, so
      // give it the headroom to survive that.
      errorCorrectionLevel: 'M',
      color: { dark, light },
    })
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        // Embedded in mail that lives for years, so let it cache hard.
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      },
    })
  } catch {
    return new Response('could not render', { status: 500 })
  }
}
