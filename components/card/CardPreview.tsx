'use client'

import { useEffect, useRef, useState } from 'react'
import { CardDesign } from '@/types/design'
import PublicCardView from './PublicCardView'
import { CardSurfaceProvider } from '@/lib/card-surface'

// Renders the REAL card, scaled down.
//
// This replaces TemplatedCardPreview, which was a second, hand-written
// miniature of every template. Keeping fifteen designs correct in two files
// was never going to hold: the miniature had no work_phone field and only
// three link slots against the card's ten, so a preview could not have matched
// the card even if every style had been copied across perfectly. In practice
// they drifted apart on almost every template.
//
// Rendering the card itself means the template picker, the live preview in the
// editor and the marketing grid are all exact by construction, and a new
// template needs writing once.
//
// EVERY PREVIEW IS DECLARED AS ONE, and that declaration is what keeps a
// preview from writing data.
//
// The claim that used to sit here - "no analytics or view counting" - was only
// half true and was quietly getting less true. CardTracker, which fires the
// view event, is mounted by the card PAGE and so is genuinely absent here. But
// PublicCardView itself carries a delegated link-click listener attached to
// the DOCUMENT, which meant the editor was recording any external link clicked
// anywhere on the page as a tap on the owner's own card, fifteen times over in
// the template picker. Contact exchange, the questionnaire, booking and the
// Context events were all reachable on the same basis.
//
// Wrapping in CardSurfaceProvider turns all of that off at once, for the whole
// subtree including the modals that portal to document.body. See
// lib/card-surface.ts for why it is a context rather than a prop.

/** The card is written for a phone, so it is laid out at one and scaled. */
const FRAME_WIDTH = 390

interface Props {
  /** The editor's form. Anything Card-shaped: extra fields are passed through,
   *  which is how the preview picks up work_phone and links 4 to 10 that the
   *  old miniature never had. */
  form: Record<string, any>
  isPro: boolean
  design: CardDesign
  /** Crop height, before scaling. Given, the preview is a tile showing the top
   *  of the card - which is where a template's identity lives. Omitted, the
   *  whole card renders at its natural height, which is what the editor's live
   *  preview wants. */
  frameHeight?: number
}

export default function CardPreview({ form, isPro, design, frameHeight }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  // Measured rather than passed in: tiles sit in responsive grids, and a scale
  // hardcoded per call site goes wrong the moment a breakpoint changes.
  //
  // Read once directly before observing. Waiting for the observer's first
  // callback meant the tile rendered nothing until it arrived, and in at least
  // one place - the editor's flip card - it never arrived at all, so the live
  // preview was simply blank. A measurement we can take now should not be
  // waited for.
  useEffect(() => {
    const el = box.current
    if (!el || !frameHeight) return
    const apply = (w: number) => { if (w > 0) setScale(w / FRAME_WIDTH) }
    apply(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(entries => apply(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [frameHeight])

  const card: any = {
    ...form,
    id: form.id || 'preview',
    slug: form.slug || 'preview',
    color_theme: JSON.stringify(design),
    addons: form.addons ?? {},
    view_count: 0,
    is_primary: true,
    user_id: null,
  }

  // No frame height means the live preview, which is not a thumbnail: the
  // panel it sits in is already about phone width, and the card is responsive,
  // so it can simply be rendered. Scaling it there bought nothing and cost the
  // whole preview when the measurement was late.
  if (!frameHeight) {
    return (
      <CardSurfaceProvider surface="preview">
        <div aria-hidden className="cardtly-card-preview" style={{ pointerEvents: 'none' }}>
          <PublicCardView card={card} isPro={isPro} />
        </div>
      </CardSurfaceProvider>
    )
  }

  return (
    <CardSurfaceProvider surface="preview">
    <div
      ref={box}
      aria-hidden
      style={{
        width: '100%',
        // The scaled card is absolutely positioned, so the box needs a height
        // of its own or it collapses to nothing.
        height: scale ? Math.round(frameHeight * scale) : undefined,
        // Before the first measurement the box still needs a height, or it
        // collapses and the tile shows as an empty strip.
        aspectRatio: scale ? undefined : `${FRAME_WIDTH} / ${frameHeight}`,
        overflow: 'hidden',
        position: 'relative',
        // A preview is a picture of a card, not a card. Without this the
        // tiles in the picker would be full of live tel: and mailto: links
        // sitting on top of the button that selects the template.
        pointerEvents: 'none',
      }}
    >
      {scale > 0 && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: FRAME_WIDTH, height: frameHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            overflow: 'hidden',
          }}
          // The back button and the share button are position-fixed and are
          // written inline in all fifteen template branches. One scoped rule
          // in globals.css hides them here rather than threading a preview
          // flag through twenty-eight call sites. Modals portal to the body,
          // so they are outside this subtree and unaffected.
          className="cardtly-card-preview"
        >
          <PublicCardView card={card} isPro={isPro} />
        </div>
      )}
    </div>
    </CardSurfaceProvider>
  )
}
