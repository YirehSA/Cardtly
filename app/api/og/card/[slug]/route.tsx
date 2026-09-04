import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { parseDesign, getAccentHex, getBgColors, getReadableTextOn } from '@/types/design'
import { ancestorChain, indexById, resolveBrandChain, type DeptNode } from '@/lib/department-tree'
import { hydrateBrandSources } from '@/lib/brand-source'
import { CARDTLY_MARK } from '@/lib/og-cardtly-mark'

// Edge runtime: next/og renders reliably here. Satori (inside it) only handles
// PNG/JPEG, and our uploads are now WebP with some older logos as GIF - both of
// which it drops silently. So we route every source image through /api/og/img,
// a small node endpoint that transcodes to PNG with sharp, and bake the result
// in as a data URL.
export const runtime = 'edge'

// ── Share-image theme ───────────────────────────────────────────────────────
// The image mirrors the card's own design: its accent colour (preset or custom),
// its light or dark background, and its text colours. So every card's share
// looks like the card - a light card gets a light share, a red card gets red -
// with no separate setting to keep in sync. Team cards inherit their team or
// department brand's colour, resolved before this runs.

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
  accent: string; avatarBorder: string; avatarFallback: string; avatarText: string
  divider: string
  nameColor: string; titleColor: string; companyColor: string; urlColor: string; barBorder: string
}

function buildTheme(colorTheme: string | null): ShareTheme {
  const design = parseDesign(colorTheme)
  // The accent resolves for every card - a preset name (red, teal, ...) or a
  // custom hex - so all cards, not just custom-branded ones, wear their colour.
  const accent = getAccentHex(design)
  // The card's own background palette: light gives a light share, dark gives a
  // dark one, and a custom card background colour comes through here too.
  const bg = getBgColors(design.bgMode, design.templateId, design.customBgColor)
  const light = design.bgMode === 'light'

  // Background: a light card is a flat light page; a dark card keeps the premium
  // accent-tinted corner fading to the card's own dark, unless the card sets a
  // specific background colour, which we then honour flat.
  const page = light || design.customBgColor
    ? bg.page
    : `linear-gradient(160deg, ${darken(accent, 0.82)} 0%, ${bg.page} 62%)`

  return {
    bg: page,
    glow1: rgba(accent, light ? 0.14 : 0.22),
    glow2: rgba(accent, light ? 0.07 : 0.12),
    accent,
    avatarBorder: rgba(accent, light ? 0.5 : 0.6),
    avatarFallback: `linear-gradient(135deg, ${accent}, ${darken(accent, 0.35)})`,
    avatarText: getReadableTextOn(accent),
    divider: accent,
    // Mirror the card's text colours, honouring any per-element overrides the
    // way the card itself does (name -> text, title -> accent, company -> muted).
    nameColor: design.nameColor || bg.text,
    titleColor: design.titleColor || accent,
    companyColor: design.companyColor || bg.subtext,
    urlColor: bg.subtext,
    barBorder: bg.border,
  }
}

// Fetch an image as a PNG data URL Satori can always render. We hand the source
// URL to /api/og/img, which transcodes any format (WebP, GIF, AVIF, PNG, JPEG)
// to PNG with sharp, then bake the bytes in as base64. On any failure we return
// null and the layout falls back to the initials avatar / no-logo, so the route
// still returns a valid image.
async function fetchImageAsDataUrl(url: string | null, origin: string): Promise<string | null> {
  if (!url) return null
  try {
    const proxied = new URL('/api/og/img', origin)
    proxied.searchParams.set('src', url)
    const res = await fetch(proxied.toString(), { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength > 2_500_000) return null
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return `data:image/png;base64,${btoa(binary)}`
  } catch {
    return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const origin = new URL(request.url).origin

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

  // Resolve the brand a team card wears (org, then department overriding it).
  // We take the colour, the company logo, and the company name from the brand,
  // because a team card's own copies of those can be stale - the brand is the
  // single source of truth for how the company currently looks.
  async function resolveBrand(): Promise<{ colorTheme: string | null; logoUrl: string | null; company: string }> {
    const own = {
      colorTheme: card?.color_theme ?? null,
      logoUrl: card?.company_logo_url ?? null,
      company: card?.company || '',
    }
    if (!brandCtx) return own
    try {
      // The whole chain, not just the card's own department.
      //
      // This used to read one department and merge it over the org, which is
      // the two-level model from before migration 053. A card inside a
      // department inside a company therefore missed the company's brand
      // entirely, and after 063 it also missed a company that had switched the
      // group look off - so the preview image showed the group's logo on a
      // card that does not wear it. This comment promised the image matches
      // the page; now it does, because both call resolveBrandChain.
      const [orgRes, deptRes] = await Promise.all([
        // select('*') so brand_source comes too: a look that follows a card is
        // read from that card, and the preview image has to match the page.
        supabase.from('organizations').select('*').eq('id', brandCtx.orgId).maybeSingle(),
        brandCtx.deptId
          ? supabase.from('departments').select('*').eq('organization_id', brandCtx.orgId)
          : Promise.resolve({ data: [] } as any),
      ])
      const [hydratedOrg, hydratedDepts] = await Promise.all([
        hydrateBrandSources(supabase, orgRes.data ? [orgRes.data] : []),
        hydrateBrandSources(supabase, deptRes.data || []),
      ])
      const nodes: DeptNode[] = (hydratedDepts as any[]).map((d: any) => ({
        id: d.id,
        organization_id: d.organization_id,
        name: d.name,
        parent_id: d.parent_id ?? null,
        kind: d.kind === 'company' ? 'company' : 'department',
        slug_segment: d.slug_segment ?? null,
        brand: d.brand || {},
        locked_fields: d.locked_fields ?? null,
        inherit_brand: d.inherit_brand ?? null,
      }))
      const chain = brandCtx.deptId ? ancestorChain(brandCtx.deptId, indexById(nodes)) : []
      const resolved = resolveBrandChain((hydratedOrg[0] as any)?.brand || {}, chain)
      return {
        colorTheme: resolved.color_theme || own.colorTheme,
        logoUrl: resolved.company_logo_url || own.logoUrl,
        company: resolved.company || own.company,
      }
    } catch {
      return own
    }
  }

  const name  = card?.name  || 'Cardtly'
  const title = card?.title || ''

  // The person's photo never comes from the brand, so fetch it concurrently
  // with the brand lookup. The logo URL depends on the resolved brand, so its
  // fetch waits for the brand - it still overlaps the (usually larger) photo.
  const photoPromise = fetchImageAsDataUrl(card?.profile_image_url || null, origin)
  const brand = await resolveBrand()
  const [photo, logo] = await Promise.all([
    photoPromise,
    fetchImageAsDataUrl(brand.logoUrl, origin),
  ])
  const company = brand.company

  // Theme the share from the (possibly brand-resolved) design.
  const theme = buildTheme(brand.colorTheme)

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
                  color: theme.avatarText,
                  fontWeight: 'bold',
                }}
              >
                {name[0]?.toUpperCase() || 'C'}
              </div>
            )}
          </div>

          {/* Text info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 'bold', color: theme.nameColor, lineHeight: 1.1, letterSpacing: '-1px', textAlign: 'center' }}>
              {name}
            </div>
            {title ? (
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, color: theme.titleColor, textAlign: 'center' }}>
                {title}
              </div>
            ) : null}
            {company ? (
              <div style={{ display: 'flex', fontSize: 20, color: theme.companyColor, textAlign: 'center' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', borderTop: `1px solid ${theme.barBorder}`, gap: 8 }}>
          <img src={CARDTLY_MARK} width={26} height={26} style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', fontSize: 16, fontWeight: 'bold', color: theme.urlColor }}>cardtly.com/card/{slug}</div>
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
