import { ImageResponse } from 'next/og'

// Sitewide default OG image. Next.js wires this in as og:image for
// every page that doesn't define its own (card pages override via
// their generateMetadata + /api/og/card/[slug]). Before this existed
// the site had twitter:card set but NO image at all, so WhatsApp /
// LinkedIn / X shares rendered as bare links.
export const runtime = 'edge'
export const alt = 'Cardtly - Digital Business Card South Africa'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a14',
          position: 'relative',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            left: 250,
            width: 700,
            height: 500,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(0,212,255,0.25) 0%, rgba(124,58,237,0.15) 50%, transparent 70%)',
            filter: 'blur(60px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            right: -100,
            width: 600,
            height: 500,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)',
            filter: 'blur(60px)',
            display: 'flex',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 28px',
            borderRadius: 9999,
            border: '2px solid rgba(0,212,255,0.4)',
            color: '#00d4ff',
            background: 'rgba(0,212,255,0.08)',
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 36,
          }}
        >
          Digital Business Card South Africa
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            fontSize: 110,
            fontWeight: 900,
            color: 'white',
            letterSpacing: -4,
            marginBottom: 20,
          }}
        >
          Cardtly
        </div>

        {/* Tagline with gradient accent */}
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
          Your card.&nbsp;
          <span
            style={{
              background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            One tap away.
          </span>
        </div>

        {/* Footer URL */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 44,
            fontSize: 28,
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          cardtly.com — free forever
        </div>
      </div>
    ),
    { ...size }
  )
}
