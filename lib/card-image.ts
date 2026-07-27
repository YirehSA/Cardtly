import sharp from 'sharp'

// Fetching a stored card image and re-encoding it small.
//
// Two callers need this and they must not drift apart: /api/email-image (mail
// clients cannot render the WebP we store) and the vCard route (a saved contact
// photo has to be a JPEG, and small enough that phones will import it).
//
// Only our own Supabase public storage is fetched. Without that check a caller
// taking a URL from the query string would be an open proxy, able to reach
// internal addresses on our behalf.

const MAX_SOURCE_BYTES = 8 * 1024 * 1024

export function isOwnStorageUrl(raw: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return false
  try {
    const url = new URL(raw)
    const allowed = new URL(base)
    return (
      url.protocol === 'https:' &&
      url.host === allowed.host &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}

export interface CardImage {
  buffer: Buffer
  contentType: 'image/jpeg' | 'image/png'
}

/**
 * Fetch a card image and re-encode it.
 *
 * `size` caps the long edge. `forceJpeg` is for places that cannot take a PNG
 * (a vCard PHOTO is declared as one type, and JPEG is the type every phone
 * accepts); otherwise transparency decides, so a logo keeps its clear
 * background and a photo gets the much smaller JPEG.
 */
export async function fetchCardImage(
  raw: string | null | undefined,
  opts: { size?: number; forceJpeg?: boolean } = {},
): Promise<CardImage | null> {
  if (!raw || !isOwnStorageUrl(raw)) return null
  const size = opts.size ?? 256

  try {
    const upstream = await fetch(raw, { cache: 'no-store' })
    if (!upstream.ok) return null
    if (!(upstream.headers.get('content-type') || '').startsWith('image/')) return null

    const source = Buffer.from(await upstream.arrayBuffer())
    if (source.byteLength > MAX_SOURCE_BYTES) return null

    const base = sharp(source)
      .rotate()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })

    const hasAlpha = !opts.forceJpeg && !!(await sharp(source).metadata()).hasAlpha
    if (hasAlpha) {
      return { buffer: await base.png({ compressionLevel: 9, palette: true }).toBuffer(), contentType: 'image/png' }
    }
    // flatten onto white: a transparent PNG forced to JPEG would otherwise get
    // a black background, which is not what a round profile photo should be.
    return {
      buffer: await base.flatten({ background: '#ffffff' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
      contentType: 'image/jpeg',
    }
  } catch {
    return null
  }
}
