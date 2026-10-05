'use client'

import { useEffect, useRef, useState } from 'react'

// Somewhere to sign: draw with a finger, mouse or pen, or (for our own
// signatures) upload a photo or scan of one.
//
// What comes out is a PNG data URL, trimmed to the ink and scaled down, with a
// transparent background so it sits on the document the way ink does rather
// than as a white box. That string is what gets stored and printed - see
// isSignaturePng in lib/billing-docs, which the server checks it against.
//
// An uploaded image on white paper has its near-white pixels made transparent
// for the same reason. A photo taken in poor light keeps some grey; the
// preview shows exactly what will print, so that is visible before saving.
//
// Deliberately light whatever the surrounding theme: it is a piece of paper.

const INK = '#111827'
const MAX_W = 760
const MAX_H = 240

export default function SignaturePad({
  onChange,
  allowUpload = false,
  height = 180,
  label = 'Sign here',
}: {
  onChange: (png: string | null) => void
  allowUpload?: boolean
  height?: number
  label?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Size the backing store to the element and the screen's pixel density, so
  // the line is sharp on a phone and the coordinates line up with the finger.
  //
  // RESIZING MUST NOT LOSE THE SIGNATURE. Setting a canvas's size clears it,
  // and phones resize the window constantly: the address bar slides away as
  // the page scrolls, the keyboard closes after typing a name. The first
  // version cleared the pad on every one of those, so a manager could sign,
  // scroll down to the button, and find the signature gone. Now only a change
  // in the pad's WIDTH counts (its height is fixed), and even then the ink is
  // copied across and redrawn at the new size.
  const fittedWidth = useRef(0)
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const style = (ctx: CanvasRenderingContext2D, dpr: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = INK
      ctx.lineWidth = 2.4
    }
    const fit = () => {
      const rect = c.getBoundingClientRect()
      const width = Math.round(rect.width)
      if (!width || width === fittedWidth.current) return
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))

      // Keep what is drawn: copy it out before the resize wipes it.
      let previous: HTMLCanvasElement | null = null
      if (fittedWidth.current && c.width && c.height) {
        previous = document.createElement('canvas')
        previous.width = c.width
        previous.height = c.height
        previous.getContext('2d')?.drawImage(c, 0, 0)
      }

      c.width = Math.round(rect.width * dpr)
      c.height = Math.round(rect.height * dpr)
      fittedWidth.current = width
      const ctx = c.getContext('2d')
      if (!ctx) return

      if (previous) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        const scale = Math.min(c.width / previous.width, c.height / previous.height)
        ctx.drawImage(previous, 0, 0, previous.width * scale, previous.height * scale)
        style(ctx, dpr)
        emit()
      } else {
        style(ctx, dpr)
      }
    }
    fit()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    observer?.observe(c)
    if (!observer) window.addEventListener('resize', fit)
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit) }
    // emit and onChange are stable enough for a resize; re-binding is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
    // A dot, so a tap or an initial with a full stop still marks the page.
    const ctx = e.currentTarget.getContext('2d')
    if (ctx && last.current) {
      ctx.beginPath()
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = INK
      ctx.fill()
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return
    e.preventDefault()
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    // Coalesced events where the browser has them: a fast stroke otherwise
    // comes out as a few straight segments instead of a curve.
    const events = (e.nativeEvent as any).getCoalescedEvents?.() || [e.nativeEvent]
    const r = e.currentTarget.getBoundingClientRect()
    for (const ev of events) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top }
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      last.current = p
    }
    if (empty) setEmpty(false)
  }

  function up() {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    emit()
  }

  function clear() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.restore()
    setEmpty(true)
    setError(null)
    onChange(null)
  }

  /** Trim to the ink, scale down, and hand the PNG up. */
  function emit() {
    const c = canvasRef.current
    if (!c) return
    const png = trimmedPng(c)
    if (!png) { setEmpty(true); onChange(null); return }
    setEmpty(false)
    onChange(png)
  }

  async function upload(file: File | null) {
    setError(null)
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setError('Use a PNG or JPG image of the signature.')
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('unreadable'))
        i.src = url
      })
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      const rect = c.getBoundingClientRect()
      // Fit inside the pad, centred, keeping its shape.
      const scale = Math.min(rect.width / img.width, rect.height / img.height, 1) * 0.92
      const w = img.width * scale
      const h = img.height * scale
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.restore()
      ctx.drawImage(img, (rect.width - w) / 2, (rect.height - h) / 2, w, h)
      whiteToTransparent(c)
      emit()
    } catch {
      setError('That image could not be read. Try a PNG or JPG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div style={{ colorScheme: 'light' }}>
      <div style={{ position: 'relative', background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          style={{ display: 'block', width: '100%', height, touchAction: 'none', cursor: 'crosshair' }}
        />
        {/* The line a pen would sign on, and what to do, until there is ink. */}
        <div aria-hidden style={{
          position: 'absolute', left: 18, right: 18, bottom: 34, borderTop: '1px dashed #9ca3af', pointerEvents: 'none',
        }} />
        {empty && (
          <span aria-hidden style={{
            position: 'absolute', left: 18, bottom: 12, fontSize: 12, color: '#6b7280', pointerEvents: 'none',
          }}>{label}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={clear}
          style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: '#111827', cursor: 'pointer' }}>
          Clear
        </button>
        {allowUpload && (
          <label style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: '#111827', cursor: 'pointer' }}>
            Upload an image instead
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
              onChange={e => { upload(e.target.files?.[0] || null); e.target.value = '' }} />
          </label>
        )}
        {error && <span style={{ fontSize: 12.5, color: '#b91c1c' }}>{error}</span>}
      </div>
    </div>
  )
}

/** Make near-white pixels transparent, for a signature photographed on paper. */
function whiteToTransparent(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')
  if (!ctx) return
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const d = data.data
  for (let i = 0; i < d.length; i += 4) {
    const lightest = Math.min(d[i], d[i + 1], d[i + 2])
    if (lightest > 215) d[i + 3] = 0
    // Paper that is not quite white fades out rather than leaving a hard edge.
    else if (lightest > 170) d[i + 3] = Math.round(d[i + 3] * (215 - lightest) / 45)
  }
  ctx.putImageData(data, 0, 0)
}

/** The ink's bounding box, cropped with a margin and scaled into MAX_W x MAX_H. */
function trimmedPng(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const { width, height } = c
  const px = ctx.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  // A single stray dot is a slip, not a signature.
  if (maxX - minX < 12 && maxY - minY < 12) return null

  const pad = 8
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad)
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const scale = Math.min(1, MAX_W / w, MAX_H / h)

  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(w * scale))
  out.height = Math.max(1, Math.round(h * scale))
  const octx = out.getContext('2d')
  if (!octx) return null
  octx.drawImage(c, minX, minY, w, h, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}
