import sharp from 'sharp'

// Serves a card image as PNG, for email signatures.
//
// Why this exists. Uploaded photos and logos are stored as WebP - excellent for
// the website, and unusable in email. Outlook on Windows renders mail through
// the Word engine and has no WebP support at all, so a signature pasted there
// showed a broken box where the profile photo and company logo should be. Gmail
// copes, which is what makes this easy to miss.
//
// The signature HTML points its <img> tags here instead of straight at storage,
// and gets a PNG every client understands. PNG rather than JPEG so a logo with a
// transparent background stays transparent.
//
// Only our own Supabase storage is proxied. Without that check this would be an
// open image proxy: anyone could pass any URL and have our server fetch it,
// which is a way to reach internal addresses and to borrow our bandwidth.

const MAX_BYTES = 8 * 1024 * 1024

function isAllowed(raw: string): URL | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  let url: URL
  let allowed: URL
  try {
    url = new URL(raw)
    allowed = new URL(base)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.host !== allowed.host) return null
  // Public storage objects only - no signed URLs, no other API surface.
  if (!url.pathname.startsWith('/storage/v1/object/public/')) return null
  return url
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url')
  if (!raw) return new Response('url required', { status: 400 })

  const target = isAllowed(raw)
  if (!target) return new Response('url not allowed', { status: 400 })

  try {
    const upstream = await fetch(target.toString(), { cache: 'no-store' })
    if (!upstream.ok) return new Response('could not fetch image', { status: 502 })

    const type = upstream.headers.get('content-type') || ''
    if (!type.startsWith('image/')) return new Response('not an image', { status: 415 })

    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) return new Response('image too large', { status: 413 })

    // Capped at 256px on the long edge. Signatures render these between 48 and
    // 76 CSS pixels, so 256 still looks sharp on a retina screen - and this
    // image is embedded in every email the customer sends, so weight matters.
    const base = sharp(buf)
      .rotate()
      .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })

    // Format by content, not by guess. A logo usually has a transparent
    // background, which only PNG keeps; a photo does not, and JPEG makes it a
    // fraction of the size. Converting everything to PNG turned a 77KB photo
    // into 291KB, which is not something to put in every outgoing mail.
    const hasAlpha = !!(await sharp(buf).metadata()).hasAlpha
    const out = hasAlpha
      ? await base.png({ compressionLevel: 9, palette: true }).toBuffer()
      : await base.jpeg({ quality: 82, mozjpeg: true }).toBuffer()

    return new Response(new Uint8Array(out), {
      headers: {
        'Content-Type': hasAlpha ? 'image/png' : 'image/jpeg',
        // Long cache: the source URL changes whenever the image does, so a
        // given URL's bytes never change.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('could not convert image', { status: 500 })
  }
}
