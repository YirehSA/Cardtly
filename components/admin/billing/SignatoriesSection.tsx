'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, PenLine, Plus, Trash2, Save, X } from 'lucide-react'
import { Section, inputClass, inputStyle, grad } from '../shared'
import SignaturePad from '@/components/billing/SignaturePad'

// Who signs Cardtly's documents: Andre and Tio, each with a signature drawn or
// uploaded once.
//
// The images live only in the billing tables and the PDFs (migration 092).
// Every invoice and purchase order keeps a COPY of the signature it was signed
// with, so replacing one here changes future documents and nothing already
// signed - the same rule as every other setting on this screen.

type Signatory = {
  id: string; name: string; title: string | null; signature_png: string
  sign_invoices: boolean; position: number
}

export default function SignatoriesSection() {
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [people, setPeople] = useState<Signatory[]>([])
  const [adding, setAdding] = useState<null | { name: string; title: string; png: string | null; sign_invoices: boolean }>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/billing/signatories')
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setUnavailable(d?.error || 'Could not load signatures'); return }
    setUnavailable(null)
    setPeople(d.signatories || [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!adding) return
    setBusy(true)
    const res = await fetch('/api/admin/billing/signatories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: adding.name, title: adding.title, signature_png: adding.png,
        sign_invoices: adding.sign_invoices, position: people.length,
      }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not save the signature'); return }
    toast.success(`${adding.name}'s signature saved`)
    setAdding(null); load()
  }

  async function toggleDefault(p: Signatory) {
    const res = await fetch('/api/admin/billing/signatories', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, sign_invoices: !p.sign_invoices }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not save'); return }
    load()
  }

  async function remove(p: Signatory) {
    if (!confirm(`Remove ${p.name}'s signature? Documents already signed keep their copy.`)) return
    const res = await fetch(`/api/admin/billing/signatories?id=${p.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d?.error) { toast.error(d?.error || 'Could not remove it'); return }
    toast.success('Removed'); load()
  }

  return (
    <Section title="Signatures"
      sub="Printed on invoices and purchase orders. Each document keeps a copy, so changing one here never alters a signed document."
      right={<PenLine className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />Loading signatures
        </div>
      ) : unavailable ? (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{unavailable}</p>
      ) : (
        <>
          {people.length === 0 && !adding && (
            <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
              No signatures yet. Add yours and Tio&apos;s, then choose who signs invoices automatically.
            </p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {people.map(p => (
              <div key={p.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {/* On white, because that is what it prints on. */}
                <div className="rounded-md flex items-center justify-center" style={{ background: '#fff', height: 84 }}>
                  <img src={p.signature_png} alt={`${p.name}'s signature`} style={{ maxHeight: 70, maxWidth: '90%', objectFit: 'contain' }} />
                </div>
                <div className="flex items-start justify-between gap-2 mt-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    {p.title && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.title}</p>}
                  </div>
                  <button onClick={() => remove(p)} title="Remove" className="p-1.5 rounded-lg shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <input type="checkbox" checked={p.sign_invoices} onChange={() => toggleDefault(p)} />
                  Signs new invoices automatically
                </label>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="mt-4 rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">New signature</p>
                <button onClick={() => setAdding(null)}><X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <input className={inputClass} style={inputStyle} placeholder="Full name, e.g. Andre Nel"
                  value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} />
                <input className={inputClass} style={inputStyle} placeholder="Position, e.g. Director"
                  value={adding.title} onChange={e => setAdding({ ...adding, title: e.target.value })} />
              </div>
              <SignaturePad allowUpload onChange={png => setAdding(a => a ? { ...a, png } : a)}
                label="Sign here, or upload an image of the signature" />
              {adding.png && (
                <div className="mt-3">
                  <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>How it will print:</p>
                  <div className="rounded-md inline-flex items-center justify-center px-4" style={{ background: '#fff', height: 70 }}>
                    <img src={adding.png} alt="Preview" style={{ maxHeight: 56, maxWidth: 260, objectFit: 'contain' }} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <input type="checkbox" checked={adding.sign_invoices}
                  onChange={e => setAdding({ ...adding, sign_invoices: e.target.checked })} />
                Signs new invoices automatically
              </label>
              <div className="flex justify-end mt-3">
                <button onClick={add} disabled={busy || !adding.name.trim() || !adding.png}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: grad, color: '#fff' }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save signature
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding({ name: '', title: '', png: null, sign_invoices: people.length === 0 })}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.75)' }}>
              <Plus className="w-3.5 h-3.5" />Add a signature
            </button>
          )}
        </>
      )}
    </Section>
  )
}
