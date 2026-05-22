import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

// Satori (the engine inside ImageResponse) has unreliable WebP support
// in the edge runtime - it crashes silently and returns 0 bytes when
// given a .webp source. We fetch images ourselves and bake them in as
// base64 data URLs. For Supabase-hosted webp/avif we try the storage
// render endpoint first, which can transcode to jpeg via the Accept
// header; if that fails or the transforms feature isn't enabled, we
// fall back to the raw URL and finally to skipping the image so the
// route still returns a valid response with the initials avatar.
function supabaseTransformCandidate(url: string): string | null {
  if (!url.includes('/storage/v1/object/public/')) return null
  const u = new URL(url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/'))
  if (!u.searchParams.has('width')) u.searchParams.set('width', '440')
  if (!u.searchParams.has('height')) u.searchParams.set('height', '440')
  if (!u.searchParams.has('quality')) u.searchParams.set('quality', '85')
  return u.toString()
}

async function tryFetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/jpeg,image/png,image/gif' },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('image/')) return null
    if (contentType.includes('webp') || contentType.includes('avif') || contentType.includes('heic')) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength > 2_500_000) return null
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const b64 = btoa(binary)
    return `data:${contentType.split(';')[0]};base64,${b64}`
  } catch {
    return null
  }
}

async function fetchImageAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  const transform = supabaseTransformCandidate(url)
  if (transform) {
    const viaTransform = await tryFetchAsDataUrl(transform)
    if (viaTransform) return viaTransform
  }
  return await tryFetchAsDataUrl(url)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // Use the service-role client so the OG image route can see team
  // cards regardless of RLS policy. The image we render is intended
  // to be public anyway, so bypassing RLS for the lookup is safe.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Check personal cards first, then fall through to team cards.
  // maybeSingle so a missing row doesn't throw - we just try the
  // other table. Wrapped in try/catch so a transient Supabase blip
  // still returns a valid (generic) OG image rather than 500ing,
  // which WhatsApp would cache as "no image" for days.
  let card: { name?: string | null; title?: string | null; company?: string | null; profile_image_url?: string | null; company_logo_url?: string | null; color_theme?: string | null } | null = null

  try {
    const { data: personalCard } = await supabase
      .from('cards')
      .select('name, title, company, profile_image_url, company_logo_url, color_theme')
      .eq('slug', slug)
      .maybeSingle()

    if (personalCard) {
      card = personalCard
    } else {
      const { data: teamCard } = await supabase
        .from('team_cards')
        .select('name, title, company, profile_image_url, company_logo_url, color_theme')
        .eq('slug', slug)
        .maybeSingle()
      if (teamCard) card = teamCard
    }
  } catch {
    // fall through and render generic Cardtly OG image
  }

  const name    = card?.name    || 'Cardtly'
  const title   = card?.title   || ''
  const company = card?.company || ''

  // Pre-fetch images in parallel and bake them in as data URLs so
  // Satori doesn't have to fetch them itself (and choke on webp).
  const [photo, logo] = await Promise.all([
    fetchImageAsDataUrl(card?.profile_image_url || null),
    fetchImageAsDataUrl(card?.company_logo_url || null),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#050510',
          position: 'relative',
        }}
      >
        {/* Gradient glow top left */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: -100,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Gradient glow bottom right */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Main content — square layout, photo top center */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 40px 20px',
            gap: 20,
          }}
        >
          {/* Avatar — large and centered */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {photo ? (
              <img
                src={photo}
                width={220}
                height={220}
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '5px solid rgba(0,212,255,0.6)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 90,
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                {name[0]?.toUpperCase() || 'C'}
              </div>
            )}
          </div>

          {/* Text info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 'bold', color: 'white', lineHeight: 1.1, letterSpacing: '-1px', textAlign: 'center' }}>
              {name}
            </div>
            {title ? (
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: '#00d4ff', textAlign: 'center' }}>
                {title}
              </div>
            ) : null}
            {company ? (
              <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                {company}
              </div>
            ) : null}
            <div style={{ display: 'flex', height: 3, width: 80, background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)', borderRadius: 2, marginTop: 4 }} />
          </div>

          {/* Logo if available */}
          {logo ? (
            <img src={logo} height={50} style={{ objectFit: 'contain', maxWidth: 140, opacity: 0.9 }} />
          ) : null}
        </div>

        {/* Bottom bar — compact for square */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', gap: 8 }}>
          <div style={{ display: 'flex', width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', color: 'white' }}>C</div>
          <div style={{ display: 'flex', fontSize: 16, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' }}>cardtly.com/card/{slug}</div>
        </div>
      </div>
    ),
    {
      width: 630,
      height: 630,
      headers: {
        // Let CDN serve cached image but allow background revalidation.
        // Avoids WhatsApp/Telegram getting a slow first response that
        // sometimes times out and gets cached as "no image".
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
