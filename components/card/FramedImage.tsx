/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react'

// A photo cropped into its frame, at its focal point and its zoom.
//
// ONE DRAWING FOR THE CARD AND THE TOOL. Every cropped image on a card - the
// Showroom hero, the gallery, the profile photo, the logo - and the frame the
// editor's drag tool shows are all drawn by this file, so what somebody frames
// in the tool is what the card shows, by construction rather than by two
// copies of the same CSS agreeing.
//
// NO ZOOM is exactly what the card always did: object-fit cover at the focal
// point.
//
// A ZOOM is a multiple of the whole photo fitted inside the frame (contain):
// 1 shows all of it, more zooms in. Scaling about the SAME point as the
// object-position keeps the focal point fixed, and works out to exactly the
// cover crop at the zoom where the photo first fills the frame (measured in a
// browser on 2026-10-08: within a pixel), so the drag means the same thing
// either side of that point. Below it, a blurred copy of the photo fills the
// edges - except where that would smear: a profile photo can have its
// background removed and a logo is often transparent, and the copy would show
// through both (backdrop={false}).

interface Props {
  src: string
  /** A CSS object-position, e.g. '50% 32%'. */
  focus: string
  /** null or undefined: fill the frame, as before zoom existed. */
  zoom?: number | null
  alt?: string
  className?: string
  /** The blurred fill behind a zoomed-out photo. Off for cut-outs and logos. */
  backdrop?: boolean
}

/** Fills its parent, which must be positioned and clip its overflow. */
export default function FramedImage({ src, focus, zoom, alt = '', className, backdrop = true }: Props) {
  const fill = { position: 'absolute' as const, inset: 0, width: '100%', height: '100%' }
  if (!zoom) {
    return <img src={src} alt={alt} aria-hidden={alt ? undefined : true} draggable={false} className={className}
      style={{ ...fill, objectFit: 'cover', objectPosition: focus }} />
  }
  return (
    <>
      {/* Behind: the same photo, filling the frame, softened so it reads as
          backdrop rather than as a second picture. Only ever seen where the
          zoomed photo does not reach. */}
      {backdrop && (
        <img src={src} alt="" aria-hidden draggable={false} className={className}
          style={{ ...fill, objectFit: 'cover', objectPosition: focus, filter: 'blur(18px) brightness(0.8)', transform: 'scale(1.15)' }} />
      )}
      <img src={src} alt={alt} aria-hidden={alt ? undefined : true} draggable={false} className={className}
        style={{ ...fill, objectFit: 'contain', objectPosition: focus, transform: `scale(${zoom})`, transformOrigin: focus }} />
    </>
  )
}

/**
 * A photo in a box of its own: `style` sizes the box (width, height, radius,
 * border). Unzoomed it is ONE <img> with that style, cover and the focal
 * point - what the card drew before, now honouring the drag on every template
 * rather than only the ones that happened to read it. Zoomed, a box of that
 * style holding a FramedImage.
 */
export function FramedBox({ src, focus, zoom, alt = '', style, className, backdrop = true }: Props & { style?: CSSProperties }) {
  if (!zoom) {
    return <img src={src} alt={alt} className={className} style={{ ...style, objectFit: 'cover', objectPosition: focus }} />
  }
  return (
    <div role={alt ? 'img' : undefined} aria-label={alt || undefined} className={className}
      style={{ ...style, position: style?.position ?? 'relative', overflow: 'hidden' }}>
      <FramedImage src={src} focus={focus} zoom={zoom} backdrop={backdrop} />
    </div>
  )
}

/**
 * A logo, which is shown WHOLE rather than cropped: the frame is the logo's
 * own shape, so zoom 1 is the logo exactly as it was, and zooming in trims the
 * empty space many logo files carry round the mark, around the focal point.
 *
 * Unzoomed it is the original <img> with the original style, untouched. Zoomed,
 * an invisible copy keeps the very same size and the framed logo is drawn over
 * it; the wrapper takes over whatever placed the logo (absolute positioning,
 * a flex shrink), so it sits exactly where the logo did.
 */
export function FramedLogo({ src, focus, zoom, alt = '', style }: Omit<Props, 'backdrop' | 'className'> & { style?: CSSProperties }) {
  if (!zoom) return <img src={src} alt={alt} style={style} />
  const s = style || {}
  return (
    <span style={{
      position: s.position ?? 'relative', top: s.top, right: s.right, bottom: s.bottom, left: s.left,
      zIndex: s.zIndex, flexShrink: s.flexShrink, maxWidth: s.maxWidth,
      display: 'inline-block', overflow: 'hidden', lineHeight: 0, verticalAlign: 'middle',
    }}>
      <img src={src} alt="" aria-hidden draggable={false}
        style={{ height: s.height, width: s.width ?? 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block', visibility: 'hidden' }} />
      <FramedImage src={src} focus={focus} zoom={zoom} alt={alt} backdrop={false} />
    </span>
  )
}
