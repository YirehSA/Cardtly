'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Mail, Phone, MessageSquare, Calendar, ScanLine, Globe, MapPin,
  Pencil, Trash2, Check, X, Loader2, MessageCircle,
} from 'lucide-react'
import AddToPhoneButton from './AddToPhoneButton'
import ShareContactButton from './ShareContactButton'
import { waLink } from '@/lib/whatsapp'

export interface ContactRow {
  id: string
  name: string
  title?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  /** Office / landline. phone is the mobile. Populated by the card scanner,
   *  which used to keep only one of the two numbers on a card. */
  work_phone?: string | null
  website?: string | null
  address?: string | null
  message?: string | null
  source?: string | null
  answers?: { label: string; value: string }[] | null
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// How each contact reached you, in plain words. Every source gets a badge:
// the old code only labelled the rare ones, so the two most common - the card
// form and its legacy name - showed nothing at all, which is most of everyone's
// list. 'contact_form' is what the card form used to write before it was
// renamed, so it maps to the same thing rather than looking like a lost source.
export const SOURCE_META: Record<string, { label: string; tone: string }> = {
  card_form:     { label: 'Filled in your form',   tone: 'bg-emerald-500/15 text-emerald-400' },
  contact_form:  { label: 'Filled in your form',   tone: 'bg-emerald-500/15 text-emerald-400' },
  questionnaire: { label: 'Answered your questions', tone: 'bg-sky-500/15 text-sky-400' },
  booking:       { label: 'Asked for a meeting',   tone: 'bg-amber-500/15 text-amber-500' },
  scanned:       { label: 'You scanned their card', tone: 'bg-violet-500/15 text-violet-400' },
}

export function sourceMeta(source?: string | null) {
  return (source && SOURCE_META[source]) || null
}

const FIELDS: { key: keyof ContactRow; label: string; placeholder: string; type?: string }[] = [
  { key: 'name',    label: 'Name',    placeholder: 'Full name' },
  { key: 'title',   label: 'Title',   placeholder: 'Job title' },
  { key: 'company', label: 'Company', placeholder: 'Company' },
  { key: 'email',   label: 'Email',   placeholder: 'name@company.com', type: 'email' },
  { key: 'phone',      label: 'Mobile', placeholder: 'Cell number', type: 'tel' },
  { key: 'work_phone', label: 'Office', placeholder: 'Landline', type: 'tel' },
  { key: 'website', label: 'Website', placeholder: 'company.com' },
  { key: 'address', label: 'Address', placeholder: 'Postal address' },
  { key: 'message', label: 'Notes',   placeholder: 'Notes' },
]

export default function ContactCard({ contact, viaLabel }: { contact: ContactRow; viaLabel?: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(contact)

  function set(key: keyof ContactRow, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!form.name?.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/contacts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contact.id,
          name: form.name, title: form.title, company: form.company,
          email: form.email, phone: form.phone, work_phone: form.work_phone, website: form.website,
          address: form.address, notes: form.message,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Contact updated')
        setEditing(false)
        router.refresh()
      } else {
        toast.error(data.error || 'Could not update')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setBusy(false)
  }

  async function remove() {
    if (!confirm(`Delete ${contact.name} from your contacts? This can't be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/contacts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contact.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Contact deleted')
        router.refresh()
      } else {
        toast.error(data.error || 'Could not delete')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setBusy(false)
  }

  // ── Edit mode ──────────────────────────────────────────────
  if (editing) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, placeholder, type }) => (
            <div key={key} className={key === 'address' || key === 'message' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
              <input
                type={type || 'text'}
                value={(form[key] as string) || ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save changes
          </button>
          <button onClick={() => { setForm(contact); setEditing(false) }} disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-border hover:bg-muted transition">
            <X className="w-3.5 h-3.5" />Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── View mode ──────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
            {contact.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-semibold text-sm">{contact.name}</p>
            {(contact.title || contact.company) && (
              <p className="text-xs text-muted-foreground">
                {[contact.title, contact.company].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />{formatDate(contact.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {viaLabel && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              via {viaLabel}
            </span>
          )}
          {(() => {
            const meta = sourceMeta(contact.source)
            if (!meta) return null
            const Icon = contact.source === 'booking' ? Calendar : contact.source === 'scanned' ? ScanLine : null
            return (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${meta.tone}`}>
                {Icon && <Icon className="w-3 h-3" />}{meta.label}
              </span>
            )
          })()}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />{contact.email}
            </a>
          )}
          {contact.work_phone && (
            <a href={`tel:${contact.work_phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{contact.work_phone}
              <span className="opacity-50">office</span>
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{contact.phone}
            </a>
          )}
        </div>
      </div>

      {contact.message && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">{contact.message}</p>
          </div>
        </div>
      )}

      {Array.isArray(contact.answers) && contact.answers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {contact.answers.map((a, i) => (
            <div key={i} className="text-sm">
              <span className="text-xs font-semibold text-muted-foreground">{a.label}</span>
              <p className="text-foreground/90 leading-relaxed">{a.value}</p>
            </div>
          ))}
        </div>
      )}

      {(contact.website || contact.address) && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {contact.website && (
            <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
              target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />{contact.website}
            </a>
          )}
          {contact.address && (
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 flex-shrink-0" />{contact.address}</span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(() => {
          const wa = waLink(contact.phone, `Hi ${contact.name?.split(' ')[0] || 'there'}, great to connect via my Cardtly card.`)
          return wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}>
              <MessageCircle className="w-3 h-3" />Message them
            </a>
          ) : null
        })()}
        {contact.email && (
          <a href={`mailto:${contact.email}?subject=Re: We connected on Cardtly`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">
            <Mail className="w-3 h-3" />Reply
          </a>
        )}
        <AddToPhoneButton contact={contact} />
        <ShareContactButton contact={contact} />
        <button onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition">
          <Pencil className="w-3 h-3" />Edit
        </button>
        <button onClick={remove} disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}Delete
        </button>
      </div>
    </div>
  )
}
