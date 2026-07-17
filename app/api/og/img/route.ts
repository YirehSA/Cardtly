import sharp from 'sharp'

export const runtime = 'nodejs'

// Transcode a Supabase-hosted image to PNG for the share-image renderer.
//
// Satori (inside the OG route's ImageResponse) only reliably renders PNG/JPEG,
// but our uploads are WebP and some older company logos are GIF - both of which
// Satori drops silently. The OG route runs on the edge runtime (that is where
// next/og renders reliably) and cannot use sharp, so it calls this small node
// endpoint to do the transcode and bakes the PNG back in as a data URL.
//
// We only ever proxy our own public storage bucket, never an arbitrary URL, so
// this cannot be turned into an open image proxy (SSRF).
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src') || ''
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!base || !src.startsWith(`${base}/storage/v1/object/public/`)) {
    return new Response('bad src', { status: 400 })
  }
  try {
    const res = await fetch(src, { headers: { Accept: 'image/*' }, signal: AbortSignal.timeout(4000) })
    if (!res.ok) return new Response('upstream', { status: 502 })
    const buf = Buffer.from(await res.arrayBuffer())
    // Cap the source we will decode. The largest logo we have seen is a 4MB
    // animated GIF; 8MB leaves headroom without inviting a memory blow-up.
    if (buf.byteLength > 8_000_000) return new Response('too large', { status: 413 })
    const png = await sharp(buf)
      .resize(440, 440, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    })
  } catch {
    return new Response('error', { status: 500 })
  }
}
