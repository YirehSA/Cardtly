'use client'

// Converts an upload to WebP, in the browser, before it ever leaves the
// device.
//
// Doing it client-side rather than server-side means there is no original on
// the server to delete afterwards, no storage spent holding one, and no
// compute spent converting it. The browser has already decoded the image to
// put it in the file picker; re-encoding it is close to free.
//
// The resize matters more than the format. A phone photo is routinely
// 4000x3000; a profile picture is displayed at a few hundred pixels. Capping
// the long edge saves far more than WebP does on its own, and the two
// together typically take a 4MB JPEG under 200KB.

export interface OptimiseResult {
  file: File
  // Null when nothing was done, with the reason, so the caller can be honest
  // rather than claim a conversion that did not happen.
  skipped?: 'unsupported' | 'animated' | 'vector' | 'already_webp' | 'failed'
  originalBytes: number
  bytes: number
}

const DEFAULT_MAX_DIM = 1600
const DEFAULT_QUALITY = 0.85

// Cheap capability probe, cached. Safari only gained canvas WebP encoding in
// 14; older browsers silently hand back a PNG from toBlob, which would be
// larger than the JPEG we started with.
let webpOk: boolean | null = null
function canEncodeWebp(): boolean {
  if (webpOk !== null) return webpOk
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    webpOk = c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpOk = false
  }
  return webpOk
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')) }
    img.src = url
  })
}

export async function optimiseImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<OptimiseResult> {
  const maxDim = opts.maxDim ?? DEFAULT_MAX_DIM
  const quality = opts.quality ?? DEFAULT_QUALITY
  const originalBytes = file.size
  const done = (f: File, skipped?: OptimiseResult['skipped']): OptimiseResult =>
    ({ file: f, skipped, originalBytes, bytes: f.size })

  // An SVG is already tiny and scales to any size. Rasterising it to WebP
  // would make it bigger AND worse, which is the opposite of the point.
  if (file.type === 'image/svg+xml') return done(file, 'vector')
  // Canvas flattens an animated GIF to its first frame, silently destroying
  // the animation. Leave it alone.
  if (file.type === 'image/gif') return done(file, 'animated')
  if (file.type === 'image/webp' && originalBytes < 400 * 1024) return done(file, 'already_webp')
  if (!canEncodeWebp()) return done(file, 'unsupported')

  try {
    const img = await loadImage(file)
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return done(file, 'failed')
    // Transparency is preserved: WebP supports alpha, so a background-removed
    // PNG survives the trip.
    ctx.drawImage(img, 0, 0, w, h)

    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/webp', quality))
    if (!blob) return done(file, 'failed')

    // If WebP somehow came out bigger, keep the original. Rare, but it happens
    // with small flat PNGs, and shipping the worse file would be absurd.
    if (blob.size >= originalBytes && file.type !== 'image/png') return done(file, 'failed')

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return done(new File([blob], name, { type: 'image/webp' }))
  } catch {
    // Never block an upload because optimisation failed. Worst case they
    // upload the original, exactly as before.
    return done(file, 'failed')
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
