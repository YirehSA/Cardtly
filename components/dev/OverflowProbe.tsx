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

interface Report {
  scrollWidth: number
  clientWidth: number
  innerWidth: number
  visualViewport: number | null
  devicePixelRatio: number
  offenders: Offender[]
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

function measure(): Report {
  const root = document.documentElement
  const vw = root.clientWidth
  const offenders: Offender[] = []

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
    if (el.hasAttribute('data-overflow-probe')) continue
    if (el.closest('[data-overflow-probe]')) continue

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
      pos: getComputedStyle(el).position,
    })

    el.style.outline = '2px solid #ff2d55'
    el.style.outlineOffset = '-2px'
  }

  // Shallowest first: a child usually sticks out because its parent does, so
  // the outermost offender is the one worth fixing.
  offenders.sort((a, b) => a.depth - b.depth)

  return {
    scrollWidth: root.scrollWidth,
    clientWidth: vw,
    innerWidth: window.innerWidth,
    visualViewport: window.visualViewport ? Math.round(window.visualViewport.width) : null,
    devicePixelRatio: window.devicePixelRatio,
    offenders,
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

    // Twice: once when the effect runs and once after images, fonts and any
    // late layout have settled, because a bleed that only appears after an
    // image loads is exactly the kind that is hard to catch by eye.
    const run = () => setReport(measure())
    run()
    const t = window.setTimeout(run, 1500)
    window.addEventListener('resize', run)
    window.addEventListener('orientationchange', run)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', run)
      window.removeEventListener('orientationchange', run)
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
        <strong style={{ color: over > 0 ? '#ff2d55' : '#22c55e' }}>
          {over > 0 ? `BLEEDING by ${over}px` : 'No horizontal overflow'}
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
      </div>

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
