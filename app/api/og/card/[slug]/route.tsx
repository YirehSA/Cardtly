import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Check personal cards first
  let card = null
  const { data: personalCard } = await supabase
    .from('cards')
    .select('name, title, company, profile_image_url, company_logo_url, color_theme')
    .eq('slug', slug)
    .single()

  if (personalCard) {
    card = personalCard
  } else {
    // Check team cards
    const { data: teamCard } = await supabase
      .from('team_cards')
      .select('name, title, company, profile_image_url, company_logo_url, color_theme')
      .eq('slug', slug)
      .single()
    if (teamCard) card = teamCard
  }

  const name    = card?.name    || 'Cardtly'
  const title   = card?.title   || ''
  const company = card?.company || ''
  const photo   = card?.profile_image_url || null
  const logo    = card?.company_logo_url  || null

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

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 80px',
            gap: 56,
          }}
        >
          {/* Avatar */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {photo ? (
              <img
                src={photo}
                width={180}
                height={180}
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid rgba(0,212,255,0.5)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: 180,
                  height: 180,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 72,
                  color: 'white',
                  fontWeight: 'bold',
                  border: '4px solid rgba(0,212,255,0.4)',
                }}
              >
                {name[0]?.toUpperCase() || 'C'}
              </div>
            )}
          </div>

          {/* Text info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 58,
                fontWeight: 'bold',
                color: 'white',
                lineHeight: 1.1,
                letterSpacing: '-1px',
              }}
            >
              {name}
            </div>

            {title ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: 30,
                  fontWeight: 600,
                  color: '#00d4ff',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </div>
            ) : null}

            {company ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: 26,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.2,
                }}
              >
                {company}
              </div>
            ) : null}

            {/* Gradient divider */}
            <div
              style={{
                display: 'flex',
                height: 3,
                width: 120,
                background: 'linear-gradient(90deg, #00d4ff, #7c3aed, #ec4899)',
                borderRadius: 2,
                marginTop: 8,
              }}
            />

            <div
              style={{
                display: 'flex',
                fontSize: 20,
                color: 'rgba(255,255,255,0.3)',
                marginTop: 4,
              }}
            >
              {`cardtly.com/card/${slug}`}
            </div>
          </div>

          {/* Company logo if available */}
          {logo ? (
            <div
              style={{
                display: 'flex',
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={logo}
                height={80}
                style={{ objectFit: 'contain', maxWidth: 160, opacity: 0.9 }}
              />
            </div>
          ) : null}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 80px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Cardtly wordmark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              C
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                fontWeight: 'bold',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              Cardtly
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 18,
              color: 'rgba(255,255,255,0.25)',
            }}
          >
            Digital Business Card
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
