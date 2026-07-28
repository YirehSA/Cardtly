'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus, X, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { describeContactError, CONTACT_NETWORK_ERROR } from '@/lib/contact-errors'

// Shown right after a visitor saves the card owner's contact, when the
// "contact exchange" add-on is enabled. Asks the visitor to share their
// own details back, which land in the owner's contacts (reusing the
// public lead-capture endpoint). Portal to body so the card's tilt/
// blur ancestors don't break the fixed overlay.

interface Props {
  open: boolean
  onClose: () => void
  ownerName: string
  cardId: string | null
  teamCardId: string | null
  accentHex: string
}

export default function ContactExchangeModal({ open, onClose, ownerName, cardId, teamCardId, accentHex }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !mounted) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { toast.error('Add your name and email'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), phone: phone.trim() || null,
          card_id: cardId, team_card_id: teamCardId,
        }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const data = await res.json().catch(() => ({}))
        const { message, detail } = describeContactError(res.status, data?.error)
        console.error('contact exchange failed:', detail)
        toast.error(message, { duration: 8000 })
      }
    } catch (err) {
      console.error('contact exchange network error:', err)
      toast.error(CONTACT_NETWORK_ERROR, { duration: 8000 })
    }
    setSubmitting(false)
  }

  const firstName = ownerName.split(' ')[0] || 'them'

  return createPortal(
    <div className="fixed inset-0 z-[150] overflow-y-auto" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl overflow-hidden border shadow-2xl"
          style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)' }}
          onClick={(e) => e.stopPropagation()}>
          {done ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
                <CheckCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Details shared</h2>
              <p className="text-sm text-white/60 mb-6">{firstName} now has your details too. Nice to connect.</p>
              <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>Done</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accentHex + '22' }}>
                    <UserPlus className="w-4 h-4" style={{ color: accentHex }} />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-white">Share your details back?</h2>
                    <p className="text-xs text-white/50">So {firstName} can reach you too</p>
                  </div>
                </div>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/60 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={submit} className="p-5 space-y-3">
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone (optional)"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }} />
                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 mt-1"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {submitting ? 'Sharing...' : 'Share my details'}
                </button>
                <button type="button" onClick={onClose} className="w-full py-2 text-xs font-medium text-white/40 hover:text-white/70 transition">
                  No thanks
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
