'use client'

import { toast } from 'sonner'
import { CardSurfaceProvider, PREVIEW_NAV_NOTICE } from '@/lib/card-surface'

// Everything a card needs in order to be shown to its own owner.
//
// TWO JOBS, AND THEY BELONG TOGETHER. The surface declaration turns off every
// write (Task 9a), and this turns off every way out of the page. A preview
// that silently posts analytics and a preview that dials a phone number are
// the same mistake: the owner is looking at their card, not using it.
//
// ONE DELEGATED HANDLER, NOT FIFTEEN TEMPLATES. The card renders anchors from
// fifteen different template branches plus the shared bottom section: tel:,
// mailto:, sms:, WhatsApp, the owner's own links and the Context CTA. Hunting
// those down individually would miss some today and go stale the next time a
// template changes. Capture phase on one wrapper catches all of them, for the
// same reason the link-click tracker attaches to the document rather than to
// each link.
//
// THE BUTTONS ARE NOT DISABLED. The owner is supposed to see what the card
// looks like, including its call and WhatsApp buttons, so they stay live and
// styled and simply do not go anywhere. Disabling them would change the very
// thing the preview exists to show.
//
// Things that leave the page WITHOUT an anchor - the vCard download and the
// WhatsApp share, which use window.location and window.open - cannot be seen
// from here and are guarded at their own call sites with useIsPreview().

export default function PreviewFrame({ children, className, style }: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  function intercept(e: React.MouseEvent) {
    const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
    if (!a) return
    const href = a.getAttribute('href') || ''
    // An in-page anchor moves the preview's own scroll and is harmless.
    if (!href || href.startsWith('#')) return
    e.preventDefault()
    toast.message(PREVIEW_NAV_NOTICE)
  }

  return (
    <CardSurfaceProvider surface="preview">
      <div onClickCapture={intercept} className={className} style={style}>
        {children}
      </div>
    </CardSurfaceProvider>
  )
}
