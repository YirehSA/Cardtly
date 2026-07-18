'use client'

import { useEffect, useRef } from 'react'

interface TrackOptions {
  // Exactly one of these should be set. cardId for a personal
  // card; teamCardId for a team card.
  cardId?: string
  teamCardId?: string
  eventType: 'view' | 'link_click' | 'contact_save' | 'qr_scan' | 'share'
  linkTitle?: string
}

async function track(opts: TrackOptions) {
  const body = JSON.stringify({
    card_id: opts.cardId,
    team_card_id: opts.teamCardId,
    event_type: opts.eventType,
    link_title: opts.linkTitle,
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

// Hook to track page view once on mount. Pass either cardId or
// teamCardId depending on which kind of card the page is rendering.
export function useTrackView(cardId?: string, teamCardId?: string) {
  const tracked = useRef(false)
  useEffect(() => {
    if (tracked.current) return
    if (!cardId && !teamCardId) return
    tracked.current = true
    track({ cardId, teamCardId, eventType: 'view' })
  }, [cardId, teamCardId])
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
export function useTrackLinkClicks(cardId?: string, teamCardId?: string) {
  useEffect(() => {
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
  }, [cardId, teamCardId])
}

// Standalone tracker for other events
export { track }
