import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { parseDesign, getAccentHex } from '@/types/design'
import { resolveTeamBrand } from '@/lib/team-brand'

export const runtime = 'edge'

// ── Share-image theme ───────────────────────────────────────────────────────
// The image follows the card's brand colour when one is set, and falls back to
// the standard Cardtly look otherwise. A company sets their colour once (their
// team or department brand), and every share of every card under it matches:
// no separate setting to keep in sync.

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '')
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (s.length !== 6 || /[^0-9a-f]/i.test(s)) return null
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }
}
function rgba(hex: string, a: number): string {
  const c = hexToRgb(hex); if (!c) return `rgba(0,212,255,${a})`
  return `rgba(${c.r},${c.g},${c.b},${a})`
}
// Mix a colour toward black; t=1 is fully black. Used for the brand-tinted
// dark background so a blue brand gets a deep-blue corner, not pure black.
function darken(hex: string, t: number): string {
  const c = hexToRgb(hex); if (!c) return '#050510'
  const m = (v: number) => Math.round(v * (1 - t))
  return `rgb(${m(c.r)},${m(c.g)},${m(c.b)})`
}

interface ShareTheme {
  bg: string; glow1: string; glow2: string
  accent: string; avatarBorder: string; avatarFallback: string; divider: string
}

function buildTheme(colorTheme: string | null): ShareTheme {
  const design = parseDesign(colorTheme)
  // Only a deliberately-chosen custom colour re-themes the share. A default or
  // preset card keeps the recognisable Cardtly look, which is the standard.
  const branded = design.accentColor === 'custom' && !!design.customAccentColor
  if (!branded) {
    return {
      bg: '#050510',
      glow1: 'rgba(0,212,255,0.18)',
      glow2: 'rgba(236,72,153,0.15)',
      accent: '#00d4ff',
      avatarBorder: 'rgba(0,212,255,0.6)',
      avatarFallback: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
      divider: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)',
    }
  }
  const accent = getAccentHex(design)
  return {
    // Brand colour as a deep corner tint fading to near-black: their own
    // background, still dark enough to keep white text readable.
    bg: `linear-gradient(160deg, ${darken(accent, 0.82)} 0%, #050510 62%)`,
    glow1: rgba(accent, 0.24),
    glow2: rgba(accent, 0.12),
    accent,
    avatarBorder: rgba(accent, 0.65),
    avatarFallback: `linear-gradient(135deg, ${accent}, ${darken(accent, 0.35)})`,
    divider: accent,
  }
}

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
  let brandCtx: { orgId: string; deptId: string | null } | null = null

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
        .select('name, title, company, profile_image_url, company_logo_url, color_theme, use_team_brand, organization_id, department_id')
        .eq('slug', slug)
        .maybeSingle()
      if (teamCard) {
        card = teamCard
        // A team card wearing the team brand takes its colour from the org (or
        // its department). We only note the ids here; the actual brand fetch
        // runs in parallel with the image fetch below, so it adds no latency.
        // WhatsApp's scraper times out on a slow image, so cold generation
        // speed is load-bearing, not a nicety.
        if ((teamCard as any).use_team_brand && (teamCard as any).organization_id) {
          brandCtx = { orgId: (teamCard as any).organization_id, deptId: (teamCard as any).department_id || null }
        }
      }
    }
  } catch {
    // fall through and render generic Cardtly OG image
  }

  // Resolve the brand colour, but do it CONCURRENTLY with the image fetch (the
  // dominant cost) so it hides under that time rather than stacking on top.
  async function resolveColorTheme(): Promise<string | null> {
    if (!brandCtx) return card?.color_theme ?? null
    try {
      const [orgRes, deptRes] = await Promise.all([
        supabase.from('organizations').select('brand').eq('id', brandCtx.orgId).maybeSingle(),
        brandCtx.deptId
          ? supabase.from('departments').select('brand').eq('id', brandCtx.deptId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ])
      const resolved = resolveTeamBrand((orgRes.data as any)?.brand || {}, (deptRes.data as any)?.brand || {})
      return resolved.color_theme || card?.color_theme || null
    } catch {
      return card?.color_theme ?? null
    }
  }

  const name    = card?.name    || 'Cardtly'
  const title   = card?.title   || ''
  const company = card?.company || ''

  // Pre-fetch images in parallel and bake them in as data URLs so
  // Satori doesn't have to fetch them itself (and choke on webp).
  const [effectiveColorTheme, photo, logo] = await Promise.all([
    resolveColorTheme(),
    fetchImageAsDataUrl(card?.profile_image_url || null),
    fetchImageAsDataUrl(card?.company_logo_url || null),
  ])

  // Theme the share from the (possibly brand-resolved) design.
  const theme = buildTheme(effectiveColorTheme)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: theme.bg,
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
            background: `radial-gradient(circle, ${theme.glow1} 0%, transparent 70%)`,
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
            background: `radial-gradient(circle, ${theme.glow2} 0%, transparent 70%)`,
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
                  border: `5px solid ${theme.avatarBorder}`,
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background: theme.avatarFallback,
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
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: theme.accent, textAlign: 'center' }}>
                {title}
              </div>
            ) : null}
            {company ? (
              <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                {company}
              </div>
            ) : null}
            <div style={{ display: 'flex', height: 3, width: 80, background: theme.divider, borderRadius: 2, marginTop: 4 }} />
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
