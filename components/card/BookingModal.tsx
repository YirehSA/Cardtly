'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  cardId: string
  cardName: string
  accentHex: string
}

// Visitor-facing modal for requesting a meeting with the card owner.
// Posts to /api/bookings/request which emails the owner via Resend
// and also drops the requester into the owner's contacts list.

export default function BookingModal({ open, onClose, cardId, cardName, accentHex }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Portals need document.body, which only exists after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Lock background scroll while the modal is open so the page behind
  // doesn't move under it.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !mounted) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: cardId,
          requester_name: name,
          requester_email: email,
          requester_phone: phone || undefined,
          preferred_date: date,
          preferred_time: time || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not send')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      toast.error('Could not send. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Tomorrow as the minimum date so people don't book for today
  const today = new Date().toISOString().slice(0, 10)

  // Rendered through a portal to document.body. The public card has
  // tilt transforms and backdrop-filters on ancestor elements, which
  // would make position:fixed anchor to the card instead of the
  // viewport - that's why the modal appeared off-screen and you had to
  // scroll up to find it. A portal escapes those ancestors entirely.
  // The outer div is the full-viewport scroll container; the inner
  // min-h-full flex wrapper centres the modal but lets the top stay
  // reachable when the form is taller than the screen.
  return createPortal(
    <div className="fixed inset-0 z-[150] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl overflow-hidden border shadow-2xl"
        style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(34,197,94,0.15)' }}>
              <CheckCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Request sent</h2>
            <p className="text-sm text-white/60 mb-6">
              {cardName.split(' ')[0]} will be in touch to confirm your meeting.
            </p>
            <button onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: accentHex + '22' }}>
                  <Calendar className="w-4 h-4" style={{ color: accentHex }} />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Book a meeting</h2>
                  <p className="text-xs text-white/50">with {cardName}</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/60 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 space-y-3">
              <input required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone (optional)"
                className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Preferred date</label>
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    min={today}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm text-white focus:outline-none focus:border-white/30 transition"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Preferred time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm text-white focus:outline-none focus:border-white/30 transition"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
                </div>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="What's it about? (optional)"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 mt-2"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                {submitting ? 'Sending request...' : 'Request meeting'}
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>,
    document.body
  )
}
