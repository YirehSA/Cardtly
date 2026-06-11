import { ImageResponse } from 'next/og'

// Generates a 660x660 PNG of the Cardtly C brand mark for use as
// the logo on Google Wallet passes. Wallet recommends 660x660
// minimum; the static favicon.png is too small and gets silently
// dropped, leaving the user-initial fallback ("A" for "Andre").
//
// We render the C in white inside a rounded square that uses the
// Cardtly brand gradient. Wallet crops to a circle, so the
// gradient shows around the C as a clean coloured ring.

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 660,
          height: 660,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 50%, #ec4899 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 500,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginTop: -40,
          }}
        >
          C
        </div>
      </div>
    ),
    {
      width: 660,
      height: 660,
      headers: {
        // 30 day cache; logo URL is stable, no per-card variation.
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    }
  )
}
