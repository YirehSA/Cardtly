'use client'

import { useEffect, useState } from 'react'
import SignaturePad from './SignaturePad'

// What a client's department manager sees, and where they sign.
//
// Light and plain on purpose, like the quote acceptance page beside it: this is
// opened by a stranger's manager, often on a phone, and every colour is stated
// outright so a dark-mode browser cannot turn the text white on a white card.

type PO = {
  number: string; status: string; issuedAt: string | null
  reference: string | null; buyerReference: string | null
  subtotal: string; vatRateBp: number; vat: string; total: string; notes: string | null
  lines: { description: string; qty: number; unit: string; amount: string }[]
  supplier: any; buyer: any
  supplierSignedBy: { name: string; title: string | null }[]
  approverRole: string; approverName: string | null
  signedAt: string | null; signerName: string | null; signerTitle: string | null
  canSign: boolean
}

const INK = '#111827'
const BODY = '#374151'
const MUTED = '#4B5563'
const LINE = '#E5E7EB'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '28px 26px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.05)',
}
const label: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1.2, color: MUTED, textTransform: 'uppercase', fontWeight: 700,
}
const num: React.CSSProperties = {
  fontSize: 13.5, textAlign: 'right', paddingLeft: 8, whiteSpace: 'nowrap', verticalAlign: 'top',
  paddingTop: 10, borderBottom: `1px solid ${LINE}`, fontVariantNumeric: 'tabular-nums',
}

export default function PurchaseOrderSignView({ token }: { token: string }) {
  const [po, setPo] = useState<PO | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [authorised, setAuthorised] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/po/${token}`)
      .then(async r => {
        if (!r.ok) { setState('missing'); return }
        const d = await r.json()
        setPo(d.purchaseOrder)
        setName(d.purchaseOrder?.approverName || '')
        setTitle(d.purchaseOrder?.approverRole || '')
        setState('ready')
      })
      .catch(() => setState('missing'))
  }, [token])

  async function sign() {
    setBusy(true); setError(null)
    const res = await fetch(`/api/po/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, title, email, signature, authorised }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || d?.error) { setError(d?.error || 'That did not go through.'); return }
    setPo(p => p ? { ...p, status: 'signed', canSign: false, signedAt: d.signedAt, signerName: d.signerName, signerTitle: d.signerTitle } : p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (state === 'loading') return <Shell><p style={{ color: MUTED }}>Loading the purchase order…</p></Shell>
  if (state === 'missing' || !po) {
    return (
      <Shell>
        <div style={card}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px', color: INK }}>This link is not valid</h1>
          <p style={{ color: BODY, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            The purchase order may have been withdrawn, or the link may be incomplete. Please ask
            whoever sent it for a new link.
          </p>
        </div>
      </Shell>
    )
  }

  const signed = po.status === 'signed'
  const ready = name.trim().length >= 2 && title.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    && !!signature && authorised

  return (
    <Shell>
      {signed && (
        <Banner tone="#059669">
          Approved{po.signerName ? ` by ${po.signerName}` : ''}{po.signerTitle ? `, ${po.signerTitle}` : ''}
          {po.signedAt ? ` on ${po.signedAt.slice(0, 10)}` : ''}. Thank you. We have been notified and will
          send the signed copy to your accounts department with the invoice.
        </Banner>
      )}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: INK }}>
              {po.supplier.tradingName || po.supplier.legalName || 'Cardtly'}
            </p>
            <p style={{ ...label, marginTop: 4 }}>Your essence. One connection</p>
          </div>
          {/* marginLeft auto keeps the block on the right when a phone wraps it
              under the name, instead of starting it at the left edge. */}
          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <p style={{ fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: INK }}>PURCHASE ORDER</p>
            <p style={{ color: MUTED, fontSize: 13, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{po.number}</p>
            {po.issuedAt && <p style={{ color: MUTED, fontSize: 13, margin: '2px 0 0' }}>Date {po.issuedAt.slice(0, 10)}</p>}
            {po.buyerReference && <p style={{ color: MUTED, fontSize: 13, margin: '2px 0 0' }}>Your ref. {po.buyerReference}</p>}
            {po.reference && <p style={{ color: MUTED, fontSize: 13, margin: '2px 0 0' }}>Re. {po.reference}</p>}
          </div>
        </div>

        <div style={{ height: 3, borderRadius: 2, margin: '20px 0', background: 'linear-gradient(90deg,#1fbbfb,#6a4be6,#f12186)' }} />

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <p style={label}>Ordered by</p>
            <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6, color: BODY }}>
              <strong style={{ color: INK }}>{po.buyer.name}</strong>
              {po.buyer.address ? <><br />{po.buyer.address}</> : null}
              {po.buyer.vatNumber ? <><br />VAT No. {po.buyer.vatNumber}</> : null}
            </p>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <p style={label}>Supplier</p>
            <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6, color: BODY }}>
              <strong style={{ color: INK }}>{po.supplier.legalName}</strong>
              {po.supplier.regNumber ? <><br />Reg. No. {po.supplier.regNumber}</> : null}
              {po.supplier.address ? <><br />{po.supplier.address}</> : null}
              {po.supplier.email ? <><br />{po.supplier.email}</> : null}
            </p>
          </div>
        </div>

        {/* Fits a phone without scrolling sideways: the description wraps and
            the figures never do. A manager approving this on a phone has to
            see every amount without hunting for it. */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 22, tableLayout: 'auto' }}>
          <thead>
            <tr>
              {['Description', 'Qty', 'Unit', 'Amount'].map((h, i) => (
                <th key={h} style={{ ...label, textAlign: i ? 'right' : 'left', paddingBottom: 6, paddingLeft: i ? 8 : 0, borderBottom: `1px solid ${INK}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l, i) => (
              <tr key={i}>
                <td style={{ fontSize: 14, padding: '10px 0', borderBottom: `1px solid ${LINE}`, color: INK, lineHeight: 1.4 }}>{l.description}</td>
                <td style={{ ...num, color: BODY }}>{l.qty}</td>
                <td style={{ ...num, color: BODY }}>{l.unit}</td>
                <td style={{ ...num, color: INK, fontWeight: 600 }}>{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginLeft: 'auto', width: 250, maxWidth: '100%', marginTop: 16 }}>
          <Row k="Subtotal" v={po.subtotal} />
          {po.vatRateBp > 0 && <Row k={`VAT @ ${(po.vatRateBp / 100).toFixed(2)}%`} v={po.vat} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${INK}`, paddingTop: 8, marginTop: 6 }}>
            <strong style={{ fontSize: 16, color: INK }}>Total</strong>
            <strong style={{ fontSize: 16, color: INK, fontVariantNumeric: 'tabular-nums' }}>{po.total}</strong>
          </div>
        </div>

        {po.notes && (
          <>
            <p style={{ ...label, marginTop: 22 }}>Notes</p>
            <p style={{ fontSize: 14, margin: '4px 0 0', lineHeight: 1.6, color: BODY }}>{po.notes}</p>
          </>
        )}

        {po.supplierSignedBy.length > 0 && (
          <p style={{ fontSize: 13, margin: '22px 0 0', color: MUTED }}>
            Signed for {po.supplier.tradingName || po.supplier.legalName} by{' '}
            {po.supplierSignedBy.map(s => s.name + (s.title ? ` (${s.title})` : '')).join(' and ')}.
          </p>
        )}
      </div>

      {po.canSign && (
        <div style={{ ...card, marginTop: 18 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 4px', color: INK }}>Approve this purchase order</h2>
          <p style={{ color: MUTED, fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
            To be signed by the {po.approverRole.toLowerCase()} for {po.buyer.name}. Your signature is printed on the
            purchase order, and we record the date, time and your details alongside it.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Field label="Your full name" value={name} onChange={setName} placeholder="As you would sign it" />
            <Field label="Your position" value={title} onChange={setTitle} placeholder="Department Manager" />
            <Field label="Your email" value={email} onChange={setEmail} placeholder="For your confirmation" type="email" wide />
          </div>

          <p style={{ fontSize: 12, fontWeight: 600, color: INK, margin: '16px 0 6px' }}>Your signature</p>
          <SignaturePad onChange={setSignature} label="Sign here with your finger or mouse" />

          <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 14, fontSize: 13.5, color: BODY, cursor: 'pointer' }}>
            <input type="checkbox" checked={authorised} onChange={e => setAuthorised(e.target.checked)} style={{ marginTop: 3 }} />
            <span>I am authorised to approve this purchase on behalf of <strong>{po.buyer.name}</strong>.</span>
          </label>

          {error && <p style={{ color: '#B91C1C', fontSize: 13.5, margin: '14px 0 0' }}>{error}</p>}

          <button
            onClick={sign}
            disabled={busy || !ready}
            style={{
              marginTop: 18,
              background: ready ? 'linear-gradient(135deg,#0369a1,#6d28d9,#be185d)' : '#E5E7EB',
              color: ready ? '#fff' : '#4B5563',
              border: 0, borderRadius: 11, padding: '13px 26px',
              fontWeight: 700, fontSize: 15, cursor: busy || !ready ? 'not-allowed' : 'pointer',
            }}>
            {busy ? 'Recording…' : 'Approve and sign'}
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', color: MUTED, fontSize: 12, margin: '22px 0 0' }}>
        {po.supplier.legalName}
        {po.supplier.regNumber ? ` · Registration No. ${po.supplier.regNumber}` : ''}
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#f4f4f5', minHeight: '100vh', padding: '28px 16px 60px', color: INK, colorScheme: 'light' }}>
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
      <span style={{ color: MUTED }}>{k}</span>
      <span style={{ color: INK, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  )
}

function Field({ label: l, value, onChange, placeholder, type = 'text', wide }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; wide?: boolean
}) {
  return (
    <label style={{ flex: wide ? '1 1 100%' : '1 1 220px' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{l}</span>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          display: 'block', width: '100%', marginTop: 6, padding: '11px 13px',
          border: '1px solid #d1d5db', borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
          color: INK, background: '#fff',
        }} />
    </label>
  )
}
