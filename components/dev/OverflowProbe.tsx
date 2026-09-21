'use client'

import { useEffect, useState } from 'react'

// A TEMPORARY, ON-DEVICE DIAGNOSTIC. Delete it once the bleed is found.
//
// WHY IT EXISTS. The iOS app scrolls sideways on the dashboard, and the
// dashboard is behind a login, so it cannot be measured from here. Everything
// reachable without signing in was measured on production at 320, 375, 390,
// 393, 414, 430, 768, 820, 834, 1024 and 1180 and is clean, and every check
// available to us is Chromium emulating a phone rather than WKWebView being
// one. There is no Web Inspector on the device, so the page has to report on
// itself.
//
// INERT UNLESS ASKED. It renders null and measures nothing unless the URL
// carries ?overflow=1, so it costs a mounted component that returns early.
//
// location.search rather than useSearchParams, deliberately: the hook forces a
// Suspense boundary on every page that uses it and breaks static generation.
// components/card/CardTracker.tsx avoids it for the same reason.

interface Offender {
  depth: number
  tag: string
  cls: string
  left: number
  right: number
  width: number
  pos: string
}

/** An element whose own content is wider than itself and is therefore being
 *  cut off or side-scrolled. This is the other reading of "bleeds to the
 *  right": nothing widens the page, something inside it is simply clipped. */
interface Clipped {
  tag: string
  cls: string
  boxWidth: number
  contentWidth: number
  overflowX: string
}

interface Report {
  scrollWidth: number
  clientWidth: number
  innerWidth: number
  visualViewport: number | null
  devicePixelRatio: number
  offenders: Offender[]
  clipped: Clipped[]
  /** The worst document overflow seen since the probe started, and where the
   *  page was scrolled when it happened. A single measurement at load misses
   *  anything that only appears further down the page. */
  worstOverflow: number
  worstAtScrollY: number
  samples: number
}

/** True when something between el and the root already clips or scrolls
 *  horizontally. Overflow inside a scroller is intentional and does not widen
 *  the page, so reporting it would bury the real answer in noise. */
function clippedByAncestor(el: Element): boolean {
  let node = el.parentElement
  while (node && node !== document.documentElement) {
    const ox = getComputedStyle(node).overflowX
    if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true
    node = node.parentElement
  }
  return false
}

function depthOf(el: Element): number {
  let d = 0
  let node: Element | null = el
  while ((node = node.parentElement)) d++
  return d
}

let worstOverflow = 0
let worstAtScrollY = 0
let samples = 0

function measure(): Report {
  const root = document.documentElement
  const vw = root.clientWidth
  const offenders: Offender[] = []
  const clipped: Clipped[] = []

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
    if (el.hasAttribute('data-overflow-probe')) continue
    if (el.closest('[data-overflow-probe]')) continue

    const cs = getComputedStyle(el)

    // CUT OFF. The element clips or scrolls horizontally and its content does
    // not fit, so something inside it is being hidden at the right edge. This
    // never widens the page, which is why the overflow check below cannot see
    // it, and it is what "bleeds to the right" looks like when the page itself
    // measures clean.
    if (cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        clipped.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().replace(/\s+/g, ' ').slice(0, 90),
          boxWidth: el.clientWidth,
          contentWidth: el.scrollWidth,
          overflowX: cs.overflowX,
        })
        el.style.outline = '2px dashed #ffd60a'
        el.style.outlineOffset = '-2px'
      }
    }

    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    // A whole pixel of slack, so sub-pixel rounding is not reported as a bug.
    if (r.right <= vw + 1) continue
    if (clippedByAncestor(el)) continue

    offenders.push({
      depth: depthOf(el),
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().replace(/\s+/g, ' ').slice(0, 90),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      pos: cs.position,
    })

    el.style.outline = '2px solid #ff2d55'
    el.style.outlineOffset = '-2px'
  }

  // Shallowest first: a child usually sticks out because its parent does, so
  // the outermost offender is the one worth fixing.
  offenders.sort((a, b) => a.depth - b.depth)
  // Widest first: the worst cut is the one to explain.
  clipped.sort((a, b) => (b.contentWidth - b.boxWidth) - (a.contentWidth - a.boxWidth))

  const over = root.scrollWidth - vw
  samples++
  if (over > worstOverflow) {
    worstOverflow = over
    worstAtScrollY = Math.round(window.scrollY)
  }

  return {
    scrollWidth: root.scrollWidth,
    clientWidth: vw,
    innerWidth: window.innerWidth,
    visualViewport: window.visualViewport ? Math.round(window.visualViewport.width) : null,
    devicePixelRatio: window.devicePixelRatio,
    offenders,
    clipped,
    worstOverflow,
    worstAtScrollY,
    samples,
  }
}

export default function OverflowProbe() {
  const [report, setReport] = useState<Report | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let on = false
    try {
      on = new URLSearchParams(window.location.search).get('overflow') === '1'
    } catch {
      // A malformed query string is not a reason to throw inside a layout.
    }
    if (!on) return

    // KEEP WATCHING. Measuring once at load misses everything that only
    // appears further down a page you have to scroll, after an image loads, or
    // after data arrives - and on the dashboard that is most of the page. The
    // worst reading is kept, with the scroll position it happened at, so the
    // banner can still report it after you have scrolled past.
    let frame = 0
    const run = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setReport(measure())
      })
    }

    run()
    const settle = window.setTimeout(run, 1500)
    const ticker = window.setInterval(run, 2000)

    window.addEventListener('resize', run)
    window.addEventListener('orientationchange', run)
    window.addEventListener('scroll', run, { passive: true })

    // Late-rendered content counts too: a list that fills in after a fetch can
    // widen the page long after load.
    const observer = new MutationObserver(run)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.clearTimeout(settle)
      window.clearInterval(ticker)
      window.removeEventListener('resize', run)
      window.removeEventListener('orientationchange', run)
      window.removeEventListener('scroll', run)
      observer.disconnect()
    }
  }, [])

  if (!report || hidden) return null

  const over = report.scrollWidth - report.clientWidth

  return (
    <div
      data-overflow-probe=""
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        maxHeight: '55vh',
        overflowY: 'auto',
        background: 'rgba(10,10,20,0.96)',
        color: '#fff',
        font: '11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
        padding: '10px 12px',
        borderBottom: '2px solid #ff2d55',
        WebkitTextSizeAdjust: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <strong style={{ color: over > 0 || report.worstOverflow > 0 ? '#ff2d55' : '#22c55e' }}>
          {over > 0
            ? `BLEEDING by ${over}px`
            : report.worstOverflow > 0
              ? `bled ${report.worstOverflow}px at scrollY ${report.worstAtScrollY} (clean here)`
              : 'No horizontal overflow'}
        </strong>
        <button
          onClick={() => setHidden(true)}
          style={{ background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: '1px 7px' }}
        >
          close
        </button>
      </div>

      <div style={{ opacity: 0.75, marginBottom: 6 }}>
        scrollWidth {report.scrollWidth} · clientWidth {report.clientWidth} · innerWidth {report.innerWidth}
        {report.visualViewport !== null ? ` · visual ${report.visualViewport}` : ''} · dpr {report.devicePixelRatio}
        {' · '}scrollY {Math.round(typeof window !== 'undefined' ? window.scrollY : 0)} · {report.samples} samples
      </div>

      {report.clipped.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: '#ffd60a' }}>
            CUT OFF ({report.clipped.length}) - content wider than its box, clipped rather than widening the page:
          </div>
          <ol style={{ margin: '3px 0 0', paddingLeft: 16 }}>
            {report.clipped.slice(0, 5).map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: '#ffe680' }}>
                  &lt;{c.tag}&gt; [{c.overflowX}]
                </span>{' '}
                box {c.boxWidth} · content {c.contentWidth} (+{c.contentWidth - c.boxWidth})
                <div style={{ opacity: 0.7, wordBreak: 'break-all' }}>{c.cls || '(no class)'}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {report.offenders.length === 0 ? (
        <div style={{ opacity: 0.75 }}>
          {over > 0
            ? 'The page is wider than the viewport but no single element sticks out. That points at a margin, a transform, or something inside a scroller rather than one wide box.'
            : 'Nothing sticks past the right edge at this width.'}
        </div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 16 }}>
          {report.offenders.slice(0, 8).map((o, i) => (
            <li key={i} style={{ marginBottom: 5 }}>
              <span style={{ color: '#ff9ab0' }}>
                &lt;{o.tag}&gt; {o.pos !== 'static' ? `[${o.pos}] ` : ''}
              </span>
              w{o.width} · {o.left}→{o.right}
              <div style={{ opacity: 0.7, wordBreak: 'break-all' }}>{o.cls || '(no class)'}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
