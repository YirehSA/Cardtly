'use client'

import { useEffect, useState } from 'react'

// What the client sees, and where they sign.
//
// Deliberately not the admin dark theme: this is the one Cardtly screen that a
// stranger's finance department opens, usually on a phone, often printed. Light,
// plain, and readable is worth more here than house style.
//
// The terms are on the page in full, above the signature. A quote that asks
// somebody to accept terms they have to open a PDF to read is a quote whose
// acceptance is easy to argue with later.

type Quote = {
  number: string; status: string; issuedAt: string | null; validUntil: string | null
  subtotal: string; vatRateBp: number; vat: string; total: string; notes: string | null
  lines: { description: string; qty: number; unit: string; amount: string }[]
  from: any; to: any; bank: any; terms: string | null
  acceptedAt: string | null; acceptedName: string | null; canAccept: boolean
  revision: number
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '28px 26px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.05)',
}
const label: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1.2, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700,
}

export default function QuoteAcceptView({ token }: { token: string }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    fetch(`/api/quote/${token}`)
      .then(async r => {
        if (!r.ok) { setState('missing'); return }
        const d = await r.json()
        setQuote(d.quote); setState('ready')
      })
      .catch(() => setState('missing'))
  }, [token])

  async function decide(decision: 'accept' | 'decline') {
    setBusy(true); setError(null)
    const res = await fetch(`/api/quote/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // The revision this page rendered. The server refuses a signature
      // against a version that has since moved on.
      body: JSON.stringify(decision === 'accept'
        ? { decision, name, email, revision: quote?.revision }
        : { decision, reason }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || d?.error) {
      setError(d?.error || 'That did not go through.')
      // A stale revision means the document on screen is out of date, so the
      // only safe thing is to show them the new one.
      if (d?.stale) setTimeout(() => window.location.reload(), 2500)
      return
    }
    setQuote(q => q ? {
      ...q, status: d.status, canAccept: false,
      acceptedAt: d.acceptedAt || q.acceptedAt, acceptedName: d.acceptedName || q.acceptedName,
    } : q)
  }

  if (state === 'loading') {
    return <Shell><p style={{ color: '#6B7280' }}>Loading your quotation…</p></Shell>
  }
  if (state === 'missing' || !quote) {
    return (
      <Shell>
        <div style={card}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>This link is not valid</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            The quotation may have been withdrawn, or the link may be incomplete. Please check the
            email it came from, or ask us to send a new one.
          </p>
        </div>
      </Shell>
    )
  }

  const accepted = quote.status === 'accepted'
  const declined = quote.status === 'declined'
  const expired = quote.status === 'expired'

  return (
    <Shell>
      {/* Banner first: the state of the document is the thing a returning
          visitor needs before they read anything else. */}
      {accepted && (
        <Banner tone="#059669">
          Accepted{quote.acceptedName ? ` by ${quote.acceptedName}` : ''}
          {quote.acceptedAt ? ` on ${quote.acceptedAt.slice(0, 10)}` : ''}. We will be in touch, and
          an invoice will follow.
        </Banner>
      )}
      {declined && <Banner tone="#6B7280">This quotation was declined. If that was a mistake, please let us know.</Banner>}
      {expired && !accepted && !declined && (
        <Banner tone="#B45309">
          This quotation lapsed on {quote.validUntil}. Please ask us for an updated one; prices may have changed.
        </Banner>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>
              {quote.from.tradingName || quote.from.legalName || 'Cardtly'}
            </p>
            <p style={{ ...label, marginTop: 4 }}>Your essence. One connection</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>QUOTATION</p>
            <p style={{ color: '#6B7280', fontSize: 13, margin: '2px 0 0' }}>{quote.number}</p>
            {quote.validUntil && (
              <p style={{ color: '#6B7280', fontSize: 13, margin: '2px 0 0' }}>Valid until {quote.validUntil}</p>
            )}
          </div>
        </div>

        <div style={{ height: 3, borderRadius: 2, margin: '20px 0', background: 'linear-gradient(90deg,#1fbbfb,#6a4be6,#f12186)' }} />

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <p style={label}>From</p>
            <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6 }}>
              <strong>{quote.from.legalName}</strong><br />
              {quote.from.address}<br />{quote.from.email}
            </p>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <p style={label}>Quote for</p>
            <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6 }}>
              <strong>{quote.to.name}</strong><br />
              {quote.to.contactPerson}<br />{quote.to.email}
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginTop: 22 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead>
              <tr>
                <th style={{ ...label, textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid #111' }}>Description</th>
                <th style={{ ...label, textAlign: 'right', paddingBottom: 6, borderBottom: '1px solid #111' }}>Qty</th>
                <th style={{ ...label, textAlign: 'right', paddingBottom: 6, borderBottom: '1px solid #111' }}>Unit</th>
                <th style={{ ...label, textAlign: 'right', paddingBottom: 6, borderBottom: '1px solid #111' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 14, padding: '10px 8px 10px 0', borderBottom: '1px solid #eee' }}>{l.description}</td>
                  <td style={{ fontSize: 14, textAlign: 'right', borderBottom: '1px solid #eee' }}>{l.qty}</td>
                  <td style={{ fontSize: 14, textAlign: 'right', borderBottom: '1px solid #eee' }}>{l.unit}</td>
                  <td style={{ fontSize: 14, textAlign: 'right', borderBottom: '1px solid #eee' }}>{l.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginLeft: 'auto', width: 250, marginTop: 16 }}>
          <Row k="Subtotal" v={quote.subtotal} />
          {quote.vatRateBp > 0 && <Row k={`VAT @ ${(quote.vatRateBp / 100).toFixed(2)}%`} v={quote.vat} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #111', paddingTop: 8, marginTop: 6 }}>
            <strong style={{ fontSize: 16 }}>Total</strong>
            <strong style={{ fontSize: 16 }}>{quote.total}</strong>
          </div>
        </div>

        {quote.notes && (
          <>
            <p style={{ ...label, marginTop: 22 }}>Notes</p>
            <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6 }}>{quote.notes}</p>
          </>
        )}

        {quote.bank?.accountNumber && (
          <div style={{ marginTop: 22, border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
            <p style={label}>Banking details</p>
            <p style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.7, color: '#374151' }}>
              {quote.bank.bankName}<br />{quote.bank.accountName}<br />
              Account: {quote.bank.accountNumber} &middot; Branch code: {quote.bank.branchCode}
              {quote.bank.accountType ? <><br />{quote.bank.accountType}</> : null}
            </p>
          </div>
        )}
      </div>

      {quote.terms && (
        <div style={{ ...card, marginTop: 18 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>Terms and conditions</h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 14px' }}>
            These form part of this quotation. Accepting below accepts these terms.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-wrap', margin: 0 }}>
            {quote.terms}
          </p>
        </div>
      )}

      {quote.canAccept && (
        <div style={{ ...card, marginTop: 18 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>Accept this quotation</h2>
          <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 16px' }}>
            Typing your name below is your signature. We record the date, time and your details
            alongside the quotation.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Your full name" value={name} onChange={setName} placeholder="As you would sign it" />
            <Field label="Your email" value={email} onChange={setEmail} placeholder="For your confirmation" type="email" />
          </div>

          <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 14, fontSize: 13.5, color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              I am authorised to accept this quotation on behalf of <strong>{quote.to.name}</strong>
              {quote.terms ? ', and I accept the terms and conditions above' : ''}.
            </span>
          </label>

          {error && (
            <p style={{ color: '#B91C1C', fontSize: 13.5, margin: '14px 0 0' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => decide('accept')}
              disabled={busy || !agreed || name.trim().length < 2 || !email.trim()}
              style={{
                background: agreed && name.trim().length >= 2 && email.trim()
                  ? 'linear-gradient(135deg,#1fbbfb,#6a4be6,#f12186)' : '#d1d5db',
                color: '#fff', border: 0, borderRadius: 11, padding: '13px 26px',
                fontWeight: 700, fontSize: 15,
                cursor: busy || !agreed ? 'not-allowed' : 'pointer',
              }}>
              {busy ? 'Recording…' : 'Accept and sign'}
            </button>
            <button onClick={() => setDeclining(v => !v)}
              style={{ background: 'none', border: 0, color: '#6B7280', fontSize: 13.5, cursor: 'pointer', textDecoration: 'underline' }}>
              I do not want to go ahead
            </button>
          </div>

          {declining && (
            <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <Field label="Anything you would like to tell us? (optional)" value={reason} onChange={setReason} placeholder="Too expensive, wrong scope, bad timing…" wide />
              <button onClick={() => decide('decline')} disabled={busy}
                style={{ marginTop: 12, background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>
                Decline this quotation
              </button>
            </div>
          )}
        </div>
      )}

      <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, margin: '22px 0 0' }}>
        {quote.from.legalName}
        {quote.from.regNumber ? ` · Registration No. ${quote.from.regNumber}` : ''}
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#f4f4f5', minHeight: '100vh', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Banner({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `${tone}14`, border: `1px solid ${tone}55`, color: tone,
      borderRadius: 12, padding: '13px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600, lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 14 }}>
      <span style={{ color: '#6B7280' }}>{k}</span><span>{v}</span>
    </div>
  )
}

function Field({ label: l, value, onChange, placeholder, type = 'text', wide }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; wide?: boolean
}) {
  return (
    <label style={{ flex: wide ? '1 1 100%' : '1 1 220px' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{l}</span>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          display: 'block', width: '100%', marginTop: 6, padding: '11px 13px',
          border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, boxSizing: 'border-box',
        }} />
    </label>
  )
}
