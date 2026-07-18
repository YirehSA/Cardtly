'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

export interface CardSample {
  /** Whose card it is, shown under the image. */
  name: string
  /** Company or role line. */
  role: string
  front: string
  back: string
}

// Real cards we have printed. Front shows the brand, back carries the QR, so
// both sides are worth seeing - hence the flip rather than one static photo.
export default function CardSamples({ samples }: { samples: CardSample[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {samples.map(s => <Flip key={s.name} sample={s} />)}
    </div>
  )
}

function Flip({ sample }: { sample: CardSample }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setFlipped(f => !f)}
        aria-pressed={flipped}
        aria-label={`${sample.name}'s card. Showing the ${flipped ? 'back' : 'front'}. Activate to turn it over.`}
        className="group w-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ perspective: 1200, background: 'transparent' }}
      >
        <span
          className="relative block w-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{
            aspectRatio: '1.586',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <Face src={sample.front} alt={`${sample.name}'s card, front`} />
          <Face src={sample.back} alt={`${sample.name}'s card, back with QR code`} back />
        </span>
      </button>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{sample.name}</p>
          <p className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{sample.role}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap mt-0.5"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          <RotateCcw className="w-3 h-3" />
          {flipped ? 'Back' : 'Tap to flip'}
        </span>
      </div>
    </div>
  )
}

function Face({ src, alt, back }: { src: string; alt: string; back?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      // Deliberately not loading="lazy". These sit inside a preserve-3d,
      // rotateY container, and the browser never issued a request for them at
      // all while lazy was set - intersection is not computed the way you would
      // hope for 3D-transformed children, so the whole section stayed blank.
      // Both faces are declared at the card's real ratio so nothing reflows as
      // they load, and the hidden face never shows through mid-turn.
      className="absolute inset-0 w-full h-full object-cover rounded-2xl"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: back ? 'rotateY(180deg)' : undefined,
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
      }}
    />
  )
}
