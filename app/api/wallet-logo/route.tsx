import { ImageResponse } from 'next/og'

// Embeds the real Cardtly app icon at a Wallet-acceptable size.
//
// The source PNG (public/wallet-logo.png) is the Android xxxhdpi
// launcher icon - 192x192. Google Wallet requires logo images to
// be at least 660x660 and silently rejects anything smaller,
// falling back to the user-initial placeholder.
//
// We render the 192x192 source inside a 660x660 dark canvas via
// next/og so the output PNG is the right size while still using
// the real Cardtly brand mark. Slight upscale, but Wallet displays
// the logo at ~40x40 in the header so the source softness is
// invisible at the rendered size.

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
          // Dark background matches the pass body and softens the
          // edges of the already-round source so Wallet's circular
          // crop doesn't double-up.
          background: '#0a0a14',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://cardtly.com/wallet-logo.png"
          alt="Cardtly"
          width={620}
          height={620}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    {
      width: 660,
      height: 660,
      headers: {
        // 30-day cache; logo is stable, no per-card variation.
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    }
  )
}
