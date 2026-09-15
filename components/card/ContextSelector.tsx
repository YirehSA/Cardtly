'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Check, ChevronRight } from 'lucide-react'
import type { ContextAudience } from '@/lib/card-context'

// The visitor's own way into Cardtly Context.
//
// THIS IS NOT A LEAD FORM, AND THE DIFFERENCE IS THE POINT. It asks one
// question, takes one tap, and never asks for a name, an email, a phone number
// or a company. A visitor can personalise the card completely anonymously.
// Contact Exchange stays a separate, deliberate act - the card must not start
// feeling like a gate you have to sign in through to read somebody's phone
// number.
//
// THE ROLES COME FROM THE CARD, not from a list in here. They are the
// audiences the owner actually configured, already validated by
// parseContextConfig, so a card offering three audiences offers three choices
// and one offering none never shows the control at all.
//
// SELECTING APPLIES IMMEDIATELY. There is no "show my personalised view"
// confirmation step: one tap changes the card and closes the sheet, because
// the whole promise is that this takes a couple of seconds.

interface Props {
  /** The card's configured audiences. Empty means render nothing. */
  audiences: readonly ContextAudience[]
  /** The audience currently selected, whatever chose it. */
  activeId: string | null
  /** True while the visitor has asked to see the complete profile. The
   *  selection is remembered underneath, so returning to it is one tap. */
  showingFull: boolean
  onSelect: (audienceId: string) => void
  onShowFull: () => void
  onReturnToContext: () => void
  accentHex: string
  accentText: string
  bg: { text: string; subtext: string; border: string; surface: string }
}

export default function ContextSelector({
  audiences, activeId, showingFull, onSelect, onShowFull, onReturnToContext,
  accentHex, accentText, bg,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Lock the page behind the sheet, and give the keyboard a way out. Same
  // conventions as the questionnaire modal this sits beside.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    // Focus into the sheet so a keyboard user is not left behind on the page.
    const t = setTimeout(() => sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus(), 30)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
      // Put focus back where it came from, or it lands on <body>.
      openerRef.current?.focus()
    }
  }, [open])

  // Nothing configured means nothing to offer. A control that opens an empty
  // sheet is worse than no control.
  if (!audiences.length) return null

  const active = audiences.find(a => a.id === activeId) || null
  const label = (a: ContextAudience) => a.label || a.id

  const choose = (id: string) => {
    onSelect(id)
    setOpen(false)
  }

  // min-h-11 is the 44px touch minimum, measured rather than assumed: these
  // started at min-h-9, which renders 36px. They are secondary controls, but a
  // secondary control is still something a thumb has to hit.
  const pill = 'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-4 min-h-11 transition hover:opacity-80'

  return (
    <div className="mt-8">
      {!active ? (
        // Nothing personalised yet: the invitation.
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition hover:opacity-90"
          style={{ backgroundColor: 'transparent', color: accentText, border: `1.5px solid ${accentHex}55` }}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4" style={{ color: accentHex }} aria-hidden="true" />
            Personalise this card for me
          </span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : (
        // Something IS personalised: say so quietly, and offer the two ways
        // out. A visitor should never wonder why a card looks arranged.
        <div
          className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ backgroundColor: bg.surface, border: `1px solid ${bg.border}` }}
        >
          <span className="flex items-center gap-2 text-xs" style={{ color: bg.subtext }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentHex }} aria-hidden="true" />
            {showingFull
              ? 'Showing the full profile'
              : <>Personalised for <strong style={{ color: bg.text }}>{label(active)}</strong></>}
          </span>

          <span className="flex items-center gap-2 ml-auto">
            <button
              ref={openerRef}
              type="button"
              onClick={() => setOpen(true)}
              className={pill}
              style={{ color: accentText, border: `1px solid ${accentHex}55` }}
            >
              Change
            </button>
            {showingFull ? (
              <button type="button" onClick={onReturnToContext} className={pill} style={{ color: bg.subtext, border: `1px solid ${bg.border}` }}>
                Back to {label(active)}
              </button>
            ) : (
              <button type="button" onClick={onShowFull} className={pill} style={{ color: bg.subtext, border: `1px solid ${bg.border}` }}>
                View full profile
              </button>
            )}
          </span>
        </div>
      )}

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[150] overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(false)}
        >
          {/* Bottom-anchored on a phone, centred once there is room. The card
              is mostly read on a phone straight after a tap or a scan, so the
              choices sit under the thumb rather than up by the notch. */}
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ctx-selector-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden border shadow-2xl"
              style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div>
                  <h2 id="ctx-selector-title" className="font-bold text-base text-white">Personalise this card</h2>
                  <p className="text-xs text-white/60 mt-0.5">What best describes you? Nothing is shared with anyone.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/60 transition flex-shrink-0"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {audiences.map(a => {
                  const isActive = a.id === activeId
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => choose(a.id)}
                      aria-pressed={isActive}
                      className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 min-h-12 text-sm font-medium text-left transition hover:opacity-85"
                      style={{
                        background: isActive ? `${accentHex}22` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? `${accentHex}66` : 'rgba(255,255,255,0.1)'}`,
                        color: '#fff',
                      }}
                    >
                      {label(a)}
                      {isActive && <Check className="w-4 h-4 flex-shrink-0" style={{ color: accentHex }} aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>

              <div className="px-5 pb-5 pt-1">
                <p className="text-[11px] leading-relaxed text-white/45">
                  This only changes how the information on this card is arranged for you. It is not
                  shared with anyone and nothing is saved.
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
