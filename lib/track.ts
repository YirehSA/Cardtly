'use client'

import type { CardSourceEventType } from './card-sources'
import type { CONTEXT_EVENT_TYPES } from './card-context'

type ContextEventType = (typeof CONTEXT_EVENT_TYPES)[number]
import { useEffect, useRef } from 'react'
import { useIsPreview } from './card-surface'

interface TrackOptions {
  // Exactly one of these should be set. cardId for a personal
  // card; teamCardId for a team card.
  cardId?: string
  teamCardId?: string
  // Arrival events (qr_scan, nfc_tap, email_click, email_qr_scan, vbg_scan)
  // are defined in lib/card-sources.ts and typed from it, so adding a source
  // there cannot leave this union behind.
  eventType: 'view' | 'link_click' | 'contact_save' | 'share' | ContextEventType | CardSourceEventType
  linkTitle?: string
  /** Optional namespaced attribution, validated at /api/analytics against an
   *  allow-list before it reaches the database. Existing call sites pass
   *  nothing and are completely unaffected: JSON.stringify drops an undefined
   *  value, so the request body does not even mention the column. That matters
   *  for deploy ordering - this code is safe to ship BEFORE migration 080 has
   *  run, because an ordinary event never references metadata at all. */
  metadata?: unknown
}

async function track(opts: TrackOptions) {
  const body = JSON.stringify({
    card_id: opts.cardId,
    team_card_id: opts.teamCardId,
    event_type: opts.eventType,
    link_title: opts.linkTitle,
    metadata: opts.metadata,
  })
  try {
    // A link click navigates away immediately, which cancels an in-flight
    // fetch and loses the event. sendBeacon is queued by the browser and
    // survives the unload, so the tap still gets counted; keepalive on the
    // fetch fallback does the same job where sendBeacon is unavailable.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/analytics', blob)) return
    }
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // Silently fail. Never block the user experience for analytics.
  }
}

/** Does nothing, and returns the same promise shape so a caller cannot tell. */
async function noTrack(_opts: TrackOptions) { /* preview surface: see lib/card-surface.ts */ }

// ── Counting a view once, for a page somebody actually looked at ────────────
//
// WHAT THIS EXISTS BECAUSE OF. Anthony's card had 33 pairs of view events on
// the same device and browser within five seconds of each other, gaps of 7ms,
// 10ms, 17ms. Nothing human reloads a page in 7ms. Each pair is two real
// document loads: one at ?s=email and one at ?s=email-qr, the link and the QR
// code out of the same email signature, opened milliseconds apart by the same
// browser. That is an email security scanner or a link prefetcher opening
// every URL in the message, and it was inflating his view count by about 8%.
//
// The per-mount ref in CardTracker cannot see any of this. It stops one
// component instance firing twice; it knows nothing about a second page load.
//
// TWO GUARDS, because the two failures are different:
//
//   visibility  a prerendered or background load has not been seen by anybody,
//               so it is not a view yet. If it is later activated the view is
//               counted then, which is the whole point of deferring rather
//               than dropping.
//   dedupe      a second load of the same card from the same browser within
//               ten seconds is the same arrival. Ten seconds and not thirty
//               minutes on purpose: a person who refreshes still gets counted,
//               so what a view MEANS does not change. Only the impossible
//               gaps disappear.

const VIEW_DEDUPE_MS = 10_000

/** True when this browser already counted a view of this card a moment ago.
 *  localStorage rather than sessionStorage so two tabs share the answer, which
 *  is exactly the case being caught. */
function viewAlreadyCounted(key: string): boolean {
  try {
    const k = `ct_view_${key}`
    const prev = Number(window.localStorage.getItem(k) || 0)
    const now = Date.now()
    if (prev && now - prev < VIEW_DEDUPE_MS) return true
    window.localStorage.setItem(k, String(now))
    return false
  } catch {
    // Private mode, blocked storage, quota. FAIL OPEN: losing a real view is
    // worse than keeping a duplicate, and this whole thing is a correction to
    // a count, not a control on one.
    return false
  }
}

/** Runs fn once the page is actually on screen, now or later. */
function whenVisible(fn: () => void): void {
  if (typeof document === 'undefined') { fn(); return }
  const doc = document as Document & { prerendering?: boolean }

  if (doc.prerendering) {
    doc.addEventListener('prerenderingchange', () => whenVisible(fn), { once: true })
    return
  }
  if (document.visibilityState === 'visible') { fn(); return }

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    document.removeEventListener('visibilitychange', onVisible)
    fn()
  }
  document.addEventListener('visibilitychange', onVisible)
}

/**
 * THE ONLY WAY A VIEW SHOULD BE COUNTED. Both entry points call this rather
 * than track() directly, so the guards cannot apply to one and not the other.
 *
 * Only the view is deduped. An arrival event (?s=email, ?s=email-qr) is a
 * different marker each time and deduping those would throw away the
 * attribution that tells the two apart.
 */
export function trackView(opts: { cardId?: string; teamCardId?: string; send?: typeof track }): void {
  const send = opts.send ?? track
  const key = opts.cardId || opts.teamCardId
  if (!key) return
  whenVisible(() => {
    if (viewAlreadyCounted(key)) return
    send({ cardId: opts.cardId, teamCardId: opts.teamCardId, eventType: 'view' })
  })
}

/**
 * THE ONLY WAY A COMPONENT INSIDE THE CARD SHOULD TRACK ANYTHING.
 *
 * Returns the real tracker on a public card and a no-op inside a dashboard
 * preview, so the decision is taken once per component rather than remembered
 * at every call site. PublicCardView deliberately does not import `track`
 * directly any more: a future `track(...)` added to that file without this
 * hook is a TypeScript error rather than a silent analytics leak.
 *
 * Nothing is queued, buffered or deferred in preview mode. The event is not
 * sent later, it is never created.
 */
export function useTrack(): typeof track {
  return useIsPreview() ? noTrack : track
}

// Hook to track page view once on mount. Pass either cardId or
// teamCardId depending on which kind of card the page is rendering.
export function useTrackView(cardId?: string, teamCardId?: string) {
  const tracked = useRef(false)
  const preview = useIsPreview()
  useEffect(() => {
    if (preview) return
    if (tracked.current) return
    if (!cardId && !teamCardId) return
    tracked.current = true
    // The ref stops this instance firing twice. trackView stops the page being
    // counted twice, which is a different thing and the one that was wrong.
    trackView({ cardId, teamCardId })
  }, [cardId, teamCardId, preview])
}

// How a tapped link should read in the owner's analytics. Prefers an explicit
// data-track-label, then the kind of link, then whatever the link actually
// says on screen - which for a custom link is its title.
function labelForLink(a: HTMLAnchorElement): string {
  const explicit = a.getAttribute('data-track-label')
  if (explicit) return explicit.slice(0, 80)

  const href = a.getAttribute('href') || ''
  if (href.startsWith('tel:')) return 'Phone'
  if (href.startsWith('mailto:')) return 'Email'
  if (href.startsWith('sms:')) return 'SMS'
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(href)) return 'WhatsApp'
  if (/maps\.google|google\.[a-z.]+\/maps/i.test(href)) return 'Address'

  const text = (a.textContent || '').trim().replace(/\s+/g, ' ')
  if (text) return text.slice(0, 80)
  try {
    return new URL(href, window.location.href).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

// Counts taps on anything the cardholder put on their card, from one delegated
// listener rather than a handler on every link. The public card renders a dozen
// templates, each with its own markup, so hooking them one by one would both
// miss links and go stale the moment a template changes. Capture phase, so it
// still fires if something downstream calls stopPropagation.
//
// NOT ARMED IN A PREVIEW, and the reason is sharper than it first looks. The
// listener is attached to the DOCUMENT, not to the card, so inside the
// dashboard it was never limited to the preview panel: any external link
// anywhere on the editor page was being recorded as a tap on the owner's own
// card. The template picker mounts fifteen previews at once, which meant
// fifteen listeners and fifteen identical events for one click. Disarming it
// here fixes the whole class rather than the one panel.
export function useTrackLinkClicks(cardId?: string, teamCardId?: string) {
  const preview = useIsPreview()
  useEffect(() => {
    if (preview) return
    if (!cardId && !teamCardId) return

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      const a = target?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return

      const href = a.getAttribute('href') || ''
      if (!href || href.startsWith('#')) return
      // Cardtly's own chrome - the footer badge, back links - is not the
      // cardholder's link, so it is not their tap to measure. The same-origin
      // test covers cardtly.com in production and localhost in development.
      if (a.hasAttribute('data-no-track')) return
      try {
        if (new URL(href, window.location.href).origin === window.location.origin) return
      } catch {
        return
      }

      track({ cardId, teamCardId, eventType: 'link_click', linkTitle: labelForLink(a) })
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [cardId, teamCardId, preview])
}

// Standalone tracker for other events
export { track }
