'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Send, Check, Loader2 } from 'lucide-react'
import {
  BUSINESS_TYPES, CLIENT_RANGES, SEAT_RANGES, PRINTING_CHOICES, PROVINCES, checkApplication,
} from '@/lib/reseller-application'

// The reseller application. Checked here with the same function the server
// uses, so a mistake is pointed out on the field itself before anything is
// sent, and the server's answer can never disagree with the page's.

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 15, outline: 'none',
}
const badStyle: React.CSSProperties = { borderColor: 'rgba(248,113,113,0.8)' }

type Form = Record<string, string>
const BLANK: Form = {
  trading_name: '', registered_name: '', registration_number: '', vat_number: '', business_type: '', website: '',
  address: '', city: '', province: '', postal_code: '',
  contact_name: '', contact_role: '', email: '', phone: '',
  expected_clients: '', expected_seats: '', printing: '', pitch: '', heard_about: '',
}

export default function ResellerApplyForm() {
  const [f, setF] = useState<Form>(BLANK)
  const [consent, setConsent] = useState(false)
  const [honey, setHoney] = useState('')
  const [bad, setBad] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const started = useRef(Date.now())

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF(p => ({ ...p, [k]: e.target.value }))
    if (bad === k) { setBad(null); setError(null) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const checked = checkApplication({ ...f, consent })
    if (!checked.ok) {
      setBad(checked.field)
      setError(checked.error)
      document.getElementById(`ra-${checked.field}`)?.focus()
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/reseller-apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, consent, website_url: honey, fill_ms: Date.now() - started.current }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setSent(true)
        document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        setBad(data.field || null)
        setError(data.error || 'We could not send your application. Please try again, or email hello@cardtly.com.')
      }
    } catch {
      setError('Network error. Please try again, or email hello@cardtly.com.')
    }
    setSending(false)
  }

  if (sent) {
    return (
      <div className="rounded-3xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} role="status">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
          <Check className="w-8 h-8" style={{ color: '#a78bfa' }} />
        </div>
        <h3 className="text-2xl font-black mb-2">Application sent</h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Thanks. We have emailed you a copy, and we will come back to you soon, usually within two working days.
        </p>
      </div>
    )
  }

  const label = (k: string, text: string, required = false) => (
    <label htmlFor={`ra-${k}`} className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
      {text}{required && <span style={{ color: '#f472b6' }}> *</span>}
    </label>
  )
  const input = (k: string, text: string, opts: { required?: boolean; type?: string; placeholder?: string; autoComplete?: string; wide?: boolean } = {}) => (
    <div className={opts.wide ? 'sm:col-span-2' : ''}>
      {label(k, text, opts.required)}
      <input id={`ra-${k}`} type={opts.type || 'text'} value={f[k]} onChange={set(k)} placeholder={opts.placeholder}
        autoComplete={opts.autoComplete} aria-invalid={bad === k} aria-required={opts.required}
        style={{ ...inputStyle, ...(bad === k ? badStyle : {}) }} />
    </div>
  )
  const select = (k: string, text: string, options: readonly string[], required = false, wide = false) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
      {label(k, text, required)}
      <select id={`ra-${k}`} value={f[k]} onChange={set(k)} aria-invalid={bad === k} aria-required={required}
        style={{ ...inputStyle, appearance: 'none', ...(bad === k ? badStyle : {}) }}>
        <option value="" style={{ background: '#111' }}>Choose...</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
      </select>
    </div>
  )
  const group = (title: string, sub: string, children: React.ReactNode) => (
    <fieldset className="space-y-4">
      <legend className="mb-1">
        <span className="block text-base font-bold">{title}</span>
        <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</span>
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  )

  return (
    <form onSubmit={submit} noValidate className="rounded-3xl p-6 sm:p-8 space-y-8"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>

      {group('Your business', 'As it should appear on your invoices.', <>
        {input('trading_name', 'Business or trading name', { required: true, autoComplete: 'organization' })}
        {input('registered_name', 'Registered company name, if different')}
        {input('registration_number', 'Company registration number', { placeholder: '2024/123456/07' })}
        {input('vat_number', 'VAT number, if VAT registered')}
        {select('business_type', 'What kind of business are you?', BUSINESS_TYPES, true)}
        {input('website', 'Website or social media page', { type: 'url', placeholder: 'https://', autoComplete: 'url' })}
        {input('address', 'Street address', { required: true, autoComplete: 'street-address', wide: true })}
        {input('city', 'City or town', { required: true, autoComplete: 'address-level2' })}
        {select('province', 'Province', PROVINCES, true)}
        {input('postal_code', 'Postal code', { required: true, autoComplete: 'postal-code' })}
      </>)}

      {group('Who we talk to', 'This person gets the reseller login once approved.', <>
        {input('contact_name', 'Full name', { required: true, autoComplete: 'name' })}
        {input('contact_role', 'Your role', { placeholder: 'Owner, director, sales manager...', autoComplete: 'organization-title' })}
        {input('email', 'Email address', { required: true, type: 'email', autoComplete: 'email' })}
        {input('phone', 'Mobile number', { required: true, type: 'tel', autoComplete: 'tel', placeholder: '082 123 4567' })}
      </>)}

      {group('Your plans', 'Rough numbers are fine. They help us set you up properly.', <>
        {select('expected_clients', 'Clients you expect to sign in the first 6 months', CLIENT_RANGES, true)}
        {select('expected_seats', 'Cards (people) across those clients in the first year', SEAT_RANGES)}
        {select('printing', 'Who will print the NFC cards?', PRINTING_CHOICES, true, true)}
        <div className="sm:col-span-2">
          {label('pitch', 'Tell us about your clients and how you would sell Cardtly', true)}
          <textarea id="ra-pitch" rows={5} value={f.pitch} onChange={set('pitch')} aria-invalid={bad === 'pitch'} aria-required
            placeholder="Who your clients are, which industries, and whether you would bundle Cardtly with other work you do for them."
            style={{ ...inputStyle, resize: 'vertical', ...(bad === 'pitch' ? badStyle : {}) }} />
        </div>
        {input('heard_about', 'How did you hear about Cardtly?', { wide: true })}
      </>)}

      {/* Invisible to people, filled in by bots, which then get a quiet success. */}
      <input type="text" value={honey} onChange={e => setHoney(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
        name="website_url" style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }} />

      <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
        <input id="ra-consent" type="checkbox" checked={consent}
          onChange={e => { setConsent(e.target.checked); if (bad === 'consent') { setBad(null); setError(null) } }}
          aria-invalid={bad === 'consent'} className="mt-1 w-4 h-4 flex-shrink-0" />
        <span>
          These details are correct, and Cardtly may use them to review this application and, if it is approved, to set up and invoice my reseller account,
          as described in the <Link href="/privacy" className="underline hover:text-white">privacy policy</Link>.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm px-4 py-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={sending}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ background: grad, boxShadow: '0 4px 24px rgba(124,58,237,0.35)' }}>
        {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send application</>}
      </button>
    </form>
  )
}
