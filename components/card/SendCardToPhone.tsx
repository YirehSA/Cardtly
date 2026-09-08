'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, Send, MessageCircle, MessageSquare, Copy, Check, Smartphone, ChevronRight } from 'lucide-react'
import {
  normaliseMsisdn, whatsappHref, smsHref, smsCost, defaultNote,
  composeMessage, isIOSDevice, isPhone, type SendChannel,
} from '@/lib/send-card'

// "Type a number, send my card to it."
//
// The mechanism is a deep link into the sender's own WhatsApp or Messages -
// see lib/send-card.ts for why there is deliberately no SMS gateway behind
// this. Everything below exists to make one thing impossible: sending a card
// to the wrong person. The number is echoed back in full international form
// before either button will do anything, because 083 and +27 83 and 83 are
// three ways of typing the same number and only one of them is what actually
// gets dialled.

const NOTE_KEY = 'cardtly:send-card-note'

// WhatsApp's dark green rather than its bright one. #25D366 is the colour
// everyone recognises and carries white text at 1.8:1, which is unreadable;
// this is the same brand at 7.7:1.
const WA_GREEN = '#075E54'

interface Props {
  /** The clean card URL. The channel marker is appended at send time. */
  cardUrl: string
  cardName: string
  company?: string | null
  accentHex?: string
}

export function SendCardModal({ open, onClose, cardUrl, cardName, company }: Props & {
  open: boolean; onClose: () => void
}) {
  const [number, setNumber] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [onPhone, setOnPhone] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Read on the client only. Both of these look at the user agent, and a
  // server render has no user agent to look at.
  useEffect(() => { setOnPhone(isPhone()) }, [])

  useEffect(() => {
    if (!open) return
    let saved: string | null = null
    try { saved = localStorage.getItem(NOTE_KEY) } catch {}
    setNote(saved ?? defaultNote(cardName, company))
    setNumber('')
    // The number is the first thing to do, so it gets the caret. The delay is
    // for the mount, not for show - focusing a field that is not in the
    // document yet silently does nothing.
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open, cardName, company])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const parsed = useMemo(() => normaliseMsisdn(number), [number])
  const typedSomething = number.replace(/\D/g, '').length > 0

  const smsMessage = composeMessage(note, cardUrl, 'sms')
  const cost = useMemo(() => smsCost(smsMessage), [smsMessage])

  function send(channel: SendChannel) {
    if (!parsed) return
    const text = composeMessage(note, cardUrl, channel)
    try { localStorage.setItem(NOTE_KEY, note) } catch {}

    if (channel === 'whatsapp') {
      // A new tab, because wa.me hands off to the app and leaving the
      // dashboard behind means the next send is one tap away.
      const win = window.open(whatsappHref(parsed.digits, text), '_blank', 'noopener,noreferrer')
      if (!win) toast.error('Your browser blocked the WhatsApp window. Allow pop-ups for cardtly.com.')
      return
    }
    // sms: has no target to open in - it hands straight to the messaging app.
    window.location.href = smsHref(parsed.digits, text, isIOSDevice())
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(composeMessage(note, cardUrl, 'whatsapp'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Message copied, link and all')
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Send your card to a phone number"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl my-0 sm:my-auto">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
            style={{ background: WA_GREEN + '1f', color: WA_GREEN }}>
            <Send className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-base leading-tight">Send your card to a number</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              It goes from your own number, so they can reply to you.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="w-9 h-9 -mr-1 -mt-1 rounded-lg grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Number */}
          <div>
            <label htmlFor="send-card-number" className="block text-sm font-medium mb-1.5">
              Their cellphone number
            </label>
            <input
              id="send-card-number"
              ref={inputRef}
              value={number}
              onChange={e => setNumber(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="083 345 4649"
              aria-describedby="send-card-number-hint"
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-border bg-background text-base tabular-nums placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ ['--tw-ring-color' as string]: 'hsl(var(--accent))' }}
            />
            {/* What we will actually dial, before anything is sent. A number
                typed for another country resolves wrongly here on purpose -
                reading this line is what catches it. */}
            <p id="send-card-number-hint" className="text-xs mt-1.5 min-h-[16px]"
              aria-live="polite">
              {parsed
                ? <span className="text-muted-foreground">
                  Sending to <span className="font-semibold text-foreground tabular-nums">{parsed.pretty}</span>
                  . Check it before you send.
                </span>
                : typedSomething
                  // Amber is the wrong colour in one theme whichever single
                  // value is picked, so both are named. 700 rather than 600 on
                  // the light side: amber-600 is 3.19:1 on white, and this is
                  // the line telling somebody their number is wrong.
                  ? <span className="text-amber-700 dark:text-amber-400">That is not a complete number yet.</span>
                  : <span className="text-muted-foreground">South African numbers can leave off the +27.</span>}
            </p>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="send-card-note" className="block text-sm font-medium mb-1.5">
              Message
            </label>
            <textarea
              id="send-card-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm leading-relaxed resize-none focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: 'hsl(var(--accent))' }}
            />
            {/* The link is shown but not editable. A message that went out
                with half a URL in it is the one way this feature can fail
                silently, so the link is never inside the box. */}
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">Your card link is added at the end:</span>
            </div>
            {/* Full strength, not a faded /80. This is the link the message
                will carry, and it is the line somebody checks when they are
                about to send their card to a client. */}
            <p className="text-xs font-mono text-muted-foreground break-all mt-0.5">{cardUrl}</p>

            <p className="text-[11px] text-muted-foreground mt-2">
              {cost.segments === 1
                ? 'Sends as one SMS.'
                : `Sends as ${cost.segments} SMS messages${cost.unicode ? ' - a special character in your message shortened the limit' : ''}.`}
              {' '}WhatsApp has no limit.
            </p>
          </div>

          {/* Send */}
          <div className="space-y-2 pt-1">
            {/* The disabled look comes from the theme, not from fixed greys.
                A hardcoded #E5E7EB panel is a quiet grey on the light theme
                and the brightest object on the screen in dark mode, which put
                the loudest thing on the panel on the one control that does
                nothing. Muted is quiet in both. */}
            <button
              onClick={() => send('whatsapp')}
              disabled={!parsed}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              style={parsed ? { background: WA_GREEN, color: '#fff' } : undefined}>
              <MessageCircle className="w-4 h-4" />
              Send on WhatsApp
            </button>

            <button
              onClick={() => send('sms')}
              disabled={!parsed}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border border-border transition hover:bg-muted disabled:cursor-not-allowed disabled:bg-transparent disabled:text-muted-foreground disabled:hover:bg-transparent">
              <MessageSquare className="w-4 h-4" />
              Send by SMS
            </button>

            {/* Not a greyed-out button with nothing to say. Silence is what
                made the New Quote button look broken. */}
            {!parsed && (
              <p className="text-xs text-center text-muted-foreground pt-0.5">
                Type their number above and both buttons come alive.
              </p>
            )}

            {!onPhone && (
              <p className="text-xs text-muted-foreground pt-1 flex items-start gap-1.5">
                <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  On a computer, WhatsApp opens in WhatsApp Web or the desktop app.
                  SMS needs a phone, or a Mac signed in to Messages.
                </span>
              </p>
            )}

            <button onClick={copyMessage}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition">
              {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#16a34a' }} /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy the message instead'}
            </button>
          </div>
        </div>

        <p className="px-5 pb-5 text-[11px] text-muted-foreground leading-relaxed">
          Nothing is sent from Cardtly. Your phone opens with the message ready and
          you press send, so it arrives from you and they can answer it.
        </p>
      </div>
    </div>
  )
}

/** Dashboard tile, styled to sit beside Tap to share. */
export default function SendCardButton({ cardUrl, cardName, company, accentHex = '#7c3aed' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors text-left">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accentHex + '14', color: accentHex }}>
          <Send className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Send to a number</p>
          <p className="text-xs text-muted-foreground mt-0.5">WhatsApp or SMS, from your own number</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <SendCardModal open={open} onClose={() => setOpen(false)}
        cardUrl={cardUrl} cardName={cardName} company={company} />
    </>
  )
}
