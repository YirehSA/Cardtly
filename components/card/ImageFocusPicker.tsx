'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { FOCUS_CENTRE, focusToXY, xyToFocus, ZOOM_MIN } from '@/types/design'
import FramedImage from '@/components/card/FramedImage'

/**
 * DRAG THE PHOTO TO SAY WHICH PART OF IT SURVIVES THE CROP.
 *
 * Every photo on a card is cropped to a shape it was not taken for, and the
 * browser crops from the centre. On the JETOUR Bryanston card that put the top
 * of the vehicle off the frame and filled the band with tarmac: the picture
 * was fine and the crop was wrong, and there was nothing the dealer could do
 * about it short of re-cropping the file before uploading.
 *
 * WHY DRAGGING RATHER THAN TWO SLIDERS. A slider labelled "vertical position"
 * asks somebody to convert what they want - the car, visible - into a number,
 * and then to guess which way it moves. Dragging the picture is the operation
 * itself. Sliders would have been less code and worse.
 *
 * WHAT IS ACTUALLY STORED is one CSS object-position per image, e.g.
 * '50% 32%', so the card applies the crop with no JavaScript, no second copy
 * of the file and no cropping service. The original upload is never modified,
 * which means a reframe is free and reversible forever.
 */

interface Props {
  /** The image being framed. */
  src: string
  /** The crop this photo will actually be shown in, width / height. The frame
   *  below is drawn at this ratio, so what the person drags is the real crop
   *  rather than an approximation of it. Left out, the frame is the image's
   *  own shape: a logo, which is shown whole and only ever trimmed. */
  aspect?: number
  value: string | undefined
  onChange: (focus: string) => void
  /** Said under the frame, so it is clear which crop is being set. */
  hint?: string
  disabled?: boolean
  /** The stored zoom (CardDesign.imageZoom), undefined for "fill the frame".
   *  With onZoomChange, the tool also offers a zoom slider. */
  zoom?: number
  onZoomChange?: (zoom: number | undefined) => void
  /** The blurred fill behind a zoomed-out photo, as the card draws it: off for
   *  profile photos and logos (see FramedImage). */
  backdrop?: boolean
}

export default function ImageFocusPicker({ src, aspect, value, onChange, hint, disabled = false, zoom, onZoomChange, backdrop = true }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  // THE LIVE VALUE DURING A DRAG lives here rather than going through onChange
  // on every pointer move. The editors hold the whole card in one state object
  // and re-render a full card preview from it; calling up on every frame made
  // the drag lag behind the finger badly enough to feel broken. The parent is
  // told once, on release.
  const [local, setLocal] = useState(() => focusToXY(value || FOCUS_CENTRE))

  // THE SAME VALUE IN A REF, and the release reads the ref rather than the
  // state. React batches, so a quick drag - pointermove and pointerup landing
  // in one tick, which is what a flick IS - left `end` closed over the value
  // from BEFORE the move, and it committed the old position over the new one.
  // The picture snapped back the instant the finger lifted and the reframe was
  // silently thrown away. Found by driving the gesture rather than by reading
  // the code, which cannot see a batching boundary.
  const localRef = useRef(local)
  const apply = useCallback((v: { x: number; y: number }) => {
    localRef.current = v
    setLocal(v)
  }, [])

  // THE ZOOM, held locally while the slider moves for the same reason as the
  // position: the parent re-renders a whole card on every change. Committed on
  // release. null means "fill the frame", the default.
  const [zoomLocal, setZoomLocal] = useState<number | null>(zoom ?? null)
  const zoomRef = useRef<number | null>(zoom ?? null)
  const applyZoom = useCallback((z: number | null) => { zoomRef.current = z; setZoomLocal(z) }, [])
  useEffect(() => { applyZoom(zoom ?? null) }, [zoom, applyZoom])
  // The zoom at which this photo exactly fills the frame: where "fill" sits on
  // the slider, measured from the photo once it has loaded.
  const [fillZoom, setFillZoom] = useState(1.5)
  // The image's own shape, for a frame with no aspect of its own.
  const [naturalAspect, setNaturalAspect] = useState(2)
  const frameAspect = aspect ?? naturalAspect

  // Follow the parent when it changes underneath us - switching template,
  // loading a card - but never while a drag is in flight, which would fight
  // the finger.
  useEffect(() => {
    if (!dragging) apply(focusToXY(value || FOCUS_CENTRE))
  }, [value, dragging, apply])

  // HOW FAR A DRAG MOVES THE CROP. The image is `cover`, so only the overflow
  // beyond the frame can move at all: a photo whose aspect nearly matches the
  // frame has almost nothing to give vertically, and one much taller than the
  // frame has a lot. Measuring the real overflow makes the picture track the
  // finger one-to-one instead of sliding fast on some photos and crawling on
  // others.
  //
  // With a zoom the photo is the whole picture fitted in (contain) and scaled,
  // so the overflow is the scaled size less the frame. It goes NEGATIVE when
  // zoomed out past the frame, and the same formula then slides the smaller
  // picture around inside it, the right way round (see FramedImage).
  const overflow = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const measure = useCallback(() => {
    const el = frameRef.current
    const img = el?.querySelector('img') as HTMLImageElement | null
    if (!el || !img || !img.naturalWidth || !img.naturalHeight) return
    if (aspect === undefined) setNaturalAspect(img.naturalWidth / img.naturalHeight)
    const fw = el.clientWidth, fh = el.clientHeight
    const contain = Math.min(fw / img.naturalWidth, fh / img.naturalHeight)
    const cover = Math.max(fw / img.naturalWidth, fh / img.naturalHeight)
    setFillZoom(cover / contain)
    const scale = zoomRef.current ? contain * zoomRef.current : cover
    const ox = img.naturalWidth * scale - fw
    const oy = img.naturalHeight * scale - fh
    overflow.current = {
      x: zoomRef.current ? ox : Math.max(0, ox),
      y: zoomRef.current ? oy : Math.max(0, oy),
    }
  }, [aspect])
  // A frame that takes the image's shape changes size once the image has
  // loaded, so measure again after it has.
  useEffect(() => {
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [frameAspect, measure])

  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    measure()
    start.current = { px: e.clientX, py: e.clientY, x: local.x, y: local.y }
    setDragging(true)
    // Pointer capture, so the drag survives the finger leaving the frame -
    // which it will, because the useful end of the range is at the edges.
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s || disabled) return
    e.preventDefault()
    const { x: ox, y: oy } = overflow.current
    // DRAG THE PICTURE, NOT THE WINDOW. Pulling the image down should reveal
    // what is above it, and object-position counts from the top, so the
    // percentage goes DOWN as the finger goes down. Getting this backwards is
    // the single thing that makes a tool like this feel broken.
    const dx = Math.abs(ox) > 0.5 ? ((s.px - e.clientX) / ox) * 100 : 0
    const dy = Math.abs(oy) > 0.5 ? ((s.py - e.clientY) / oy) * 100 : 0
    apply({
      x: Math.max(0, Math.min(100, s.x + dx)),
      y: Math.max(0, Math.min(100, s.y + dy)),
    })
  }

  const end = () => {
    if (!start.current) return
    start.current = null
    setDragging(false)
    // localRef, not local. See the comment on the ref.
    onChange(xyToFocus(localRef.current.x, localRef.current.y))
  }

  // KEYBOARD, because a drag is a mouse gesture and this is a real control.
  // Five percent a press is coarse enough to get somewhere and fine enough to
  // land on it.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    const step = e.shiftKey ? 1 : 5
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    const next = {
      x: Math.max(0, Math.min(100, local.x + m[0])),
      y: Math.max(0, Math.min(100, local.y + m[1])),
    }
    apply(next)
    onChange(xyToFocus(next.x, next.y))
  }

  // Three times closer than "fills the frame", whatever shape the photo is.
  const zoomMax = Math.max(3, Math.round(fillZoom * 3 * 100) / 100)

  const focus = xyToFocus(local.x, local.y)
  const centred = focus === FOCUS_CENTRE

  return (
    <div>
      <div
        ref={frameRef}
        role="application"
        aria-label={`Reframe this photo. ${hint || ''} Drag it, or use the arrow keys.`}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        className={`relative overflow-hidden rounded-xl border border-border select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${disabled ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        // touchAction none, or the browser scrolls the page instead of giving
        // us the pointermove events. This is the whole gesture on a phone.
        style={{ aspectRatio: String(frameAspect), touchAction: 'none' }}
      >
        {/* The card's own drawing, so the tool cannot disagree with it. */}
        <FramedImage src={src} focus={focus} zoom={zoomLocal} backdrop={backdrop} className="pointer-events-none" />
        {/* Measures the photo once loaded; FramedImage's images have no
            onLoad of their own. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden onLoad={measure} className="hidden" />

        {/* Thirds, shown only while dragging. A framing guide that is always
            on becomes part of the furniture and stops being read. */}
        {dragging && (
          <div aria-hidden className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, transparent 33.33%, rgba(255,255,255,0.45) 33.33%, rgba(255,255,255,0.45) calc(33.33% + 1px), transparent calc(33.33% + 1px), transparent 66.66%, rgba(255,255,255,0.45) 66.66%, rgba(255,255,255,0.45) calc(66.66% + 1px), transparent calc(66.66% + 1px)),' +
                'linear-gradient(to bottom, transparent 33.33%, rgba(255,255,255,0.45) 33.33%, rgba(255,255,255,0.45) calc(33.33% + 1px), transparent calc(33.33% + 1px), transparent 66.66%, rgba(255,255,255,0.45) 66.66%, rgba(255,255,255,0.45) calc(66.66% + 1px), transparent calc(66.66% + 1px))',
            }} />
        )}

        {!disabled && !dragging && (
          <div aria-hidden className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold text-white pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            <Move className="w-3 h-3" />
            Drag to reframe
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-1.5">
        <p className="text-[11px] text-muted-foreground">
          {hint || 'This is the crop that appears on your card.'}
        </p>
        {!disabled && !centred && (
          <button type="button"
            onClick={() => { apply({ x: 50, y: 50 }); onChange(FOCUS_CENTRE) }}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition shrink-0">
            <RotateCcw className="w-3 h-3" />
            Recentre
          </button>
        )}
      </div>

      {/* ZOOM. Left is the whole photo, right is in close; the photo starts
          wherever it exactly fills the frame, which is what it did before
          there was a slider. Committed on release, like the drag. */}
      {onZoomChange && (
        <div className={`mt-3 ${disabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <button type="button" disabled={disabled} aria-label="Zoom out"
              onClick={() => { const z = Math.max(ZOOM_MIN, (zoomRef.current ?? fillZoom) / 1.15); applyZoom(z); onZoomChange(z) }}
              className="w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted transition disabled:cursor-not-allowed">
              <ZoomOut className="w-4 h-4" />
            </button>
            <input type="range" aria-label="Zoom" disabled={disabled}
              min={ZOOM_MIN} max={zoomMax} step={0.01}
              value={zoomLocal ?? fillZoom}
              onChange={e => applyZoom(Number(e.target.value))}
              onPointerUp={() => { if (zoomRef.current) onZoomChange(zoomRef.current) }}
              onKeyUp={() => { if (zoomRef.current) onZoomChange(zoomRef.current) }}
              className="flex-1 disabled:cursor-not-allowed" />
            <button type="button" disabled={disabled} aria-label="Zoom in"
              onClick={() => { const z = Math.min(zoomMax, (zoomRef.current ?? fillZoom) * 1.15); applyZoom(z); onZoomChange(z) }}
              className="w-8 h-8 grid place-items-center rounded-lg border border-border hover:bg-muted transition disabled:cursor-not-allowed">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 mt-1">
            <p className="text-[11px] text-muted-foreground">
              {zoomLocal === null
                ? (fillZoom > 1.01 ? 'Fills the frame. Slide left to fit more of the photo in, right to zoom in.' : 'Slide right to zoom in and trim the edges.')
                : zoomLocal < fillZoom - 0.01
                  ? (backdrop ? 'Zoomed out: the edges are filled with a soft copy of the photo.' : 'Zoomed out: the whole photo fits, with space round it.')
                  : 'Zoomed in.'}
            </p>
            {!disabled && zoomLocal !== null && (
              <button type="button"
                onClick={() => { applyZoom(null); onZoomChange(undefined) }}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition shrink-0">
                <RotateCcw className="w-3 h-3" />
                {fillZoom > 1.01 ? 'Fill the frame' : 'Reset zoom'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
