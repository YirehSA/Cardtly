'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, X, Loader2, CheckCircle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { safeHex, type QuestionnaireConfig } from '@/lib/questionnaire'

// Custom questionnaire on a public card (add-on). A trigger button
// that opens a modal: fixed fields (name, email, contact, company),
// the client's custom questions, then a message box. Submits to
// /api/questionnaire/submit -> the owner's Contacts.

interface Props {
  config: QuestionnaireConfig
  cardId: string | null
  teamCardId: string | null
  ownerName: string
  accentHex: string
  bg: { border: string; subtext: string; text: string }
}

export default function QuestionnaireForm({ config, cardId, teamCardId, ownerName, accentHex, bg }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const title = config.title || `A few questions for ${ownerName.split(' ')[0] || 'us'}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { toast.error('Please add your name and email'); return }
    for (const q of config.questions) {
      if (q.required && !(answers[q.id] || '').trim()) {
        toast.error(`"${q.label}" is required`); return
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/questionnaire/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: cardId, team_card_id: teamCardId,
          name: name.trim(), email: email.trim(), phone: phone.trim(), company: company.trim(), message: message.trim(),
          answers: config.questions.map(q => ({ label: q.label, value: answers[q.id] || '' })),
        }),
      })
      if (res.ok) setDone(true)
      else toast.error('Could not submit. Please try again.')
    } catch {
      toast.error('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  const field = "w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
  const fieldStyle = { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }

  // Re-validated here, not just where it was saved. This config is read back
  // out of a jsonb column that predates the sanitiser, so a row written before
  // it existed can still hold anything.
  const btnBg = safeHex(config.buttonBg)
  const btnText = safeHex(config.buttonText) || '#ffffff'
  const btnBorder = safeHex(config.buttonBorder)
  // A border with no fill is a legitimate look - an outlined button on the
  // card's own background - so styling switches on either being set, not on
  // the fill alone.
  const styled = !!(btnBg || btnBorder)

  return (
    <>
      {/* Two looks. Left alone it is the original translucent wash of the card's
          accent, which sits quietly and which people found too quiet. Given a
          colour it becomes a solid, filled button - the thing you actually want
          somebody to press. Both are driven from the same two fields so there
          is no third state to keep in step. */}
      <button onClick={() => setOpen(true)}
        className="group w-full mt-3 py-3 px-3.5 rounded-2xl text-sm font-semibold flex items-center justify-between gap-3 transition hover:-translate-y-0.5"
        style={styled
          ? {
              // Solid, not a wash. 2px border to match the Save Contact
              // button, which is the one it sits under.
              background: btnBg || 'transparent',
              border: btnBorder ? `2px solid ${btnBorder}` : (btnBg ? `1px solid ${btnBg}` : 'none'),
              color: btnText,
              boxShadow: btnBg ? `0 6px 20px -8px ${btnBg}` : 'none',
            }
          : {
              background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}0d)`,
              border: `1px solid ${accentHex}55`,
              color: bg.text,
              boxShadow: `0 4px 16px -6px ${accentHex}55`,
            }}>
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: btnBg ? 'rgba(255,255,255,0.18)' : (btnBorder ? btnBorder + '2e' : accentHex + '2e') }}>
            <ClipboardList className="w-4 h-4" style={{ color: styled ? btnText : accentHex }} />
          </span>
          <span className="truncate">{config.title || 'Answer a few questions'}</span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: styled ? btnText : accentHex }} />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[150] overflow-y-auto" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={() => setOpen(false)}>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl overflow-hidden border shadow-2xl"
              style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
              {done ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
                    <CheckCircle className="w-8 h-8" style={{ color: '#22c55e' }} />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Thanks</h2>
                  <p className="text-sm text-white/60 mb-6">Your answers have been sent to {ownerName.split(' ')[0] || 'them'}.</p>
                  <button onClick={() => setOpen(false)} className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>Done</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentHex + '22' }}>
                        <ClipboardList className="w-4 h-4" style={{ color: accentHex }} />
                      </div>
                      <h2 className="font-bold text-base text-white truncate">{title}</h2>
                    </div>
                    <button onClick={() => setOpen(false)} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-white/60 transition flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={submit} className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                    {/* Fixed standard fields */}
                    <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={field} style={fieldStyle} />
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className={field} style={fieldStyle} />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Contact number" className={field} style={fieldStyle} />
                    <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" className={field} style={fieldStyle} />

                    {/* Custom questions */}
                    {config.questions.length > 0 && (
                      <div className="pt-2 mt-2 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        {config.questions.map(q => (
                          <div key={q.id}>
                            <label className="block text-xs font-medium text-white/70 mb-1.5">
                              {q.label}{q.required && <span className="text-red-400"> *</span>}
                            </label>
                            {q.type === 'dropdown' ? (
                              <select value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className={field} style={fieldStyle}>
                                <option value="">Select...</option>
                                {(q.options || []).map(o => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
                              </select>
                            ) : q.type === 'paragraph' ? (
                              <textarea value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} rows={3} className={`${field} resize-none`} style={fieldStyle} />
                            ) : (
                              <input value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className={field} style={fieldStyle} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message box */}
                    <div className="pt-2 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Message (optional)" className={`${field} resize-none`} style={fieldStyle} />
                    </div>

                    <button type="submit" disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50 mt-1"
                      style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                      {submitting ? 'Sending...' : 'Submit'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
