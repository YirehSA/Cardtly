'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, Loader2, ScanLine, Check, Smartphone, RotateCcw, User, Building2, Mail, Phone, Globe, MapPin, Briefcase } from 'lucide-react'
import { saveToPhone } from '@/lib/save-to-phone'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface Parsed {
  name: string; title: string; company: string
  email: string; phone: string; website: string; address: string
}

const EMPTY: Parsed = { name: '', title: '', company: '', email: '', phone: '', website: '', address: '' }

type Stage = 'capture' | 'scanning' | 'review'

// Load a File into an <img>, draw it onto a canvas scaled so the long
// edge is <= maxEdge, and return a JPEG data URL. Keeps the upload
// small and fast regardless of the original photo size.
function resizeImage(file: File, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxEdge / Math.max(width, height))
      const w = Math.round(width * scale)
      const h = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

export default function CardScanner() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState<Parsed>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function reset() {
    setStage('capture')
    setPreview(null)
    setForm(EMPTY)
    setSaved(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Downscale in the browser before upload. A raw phone photo is
    // several MB - as base64 it blows past the serverless request
    // limit (causing a "network error") and is slow for the vision
    // model. 1600px on the long edge keeps card text legible while
    // landing well under the limit.
    let dataUrl: string
    try {
      dataUrl = await resizeImage(file, 1600, 0.82)
    } catch {
      toast.error('Could not read that image. Try a different photo.')
      return
    }

    setPreview(dataUrl)
    setStage('scanning')

    try {
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not read the card. Try a clearer, well-lit photo.')
        setStage('capture')
        return
      }
      setForm({ ...EMPTY, ...data.contact })
      setStage('review')
    } catch {
      toast.error('Network error. Please try again.')
      setStage('capture')
    }
  }

  function update(field: keyof Parsed, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function saveToContacts() {
    if (!form.name.trim()) { toast.error('Add a name first'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/contacts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSaved(true)
        toast.success(`${form.name.split(' ')[0]} saved to your contacts`)
      } else {
        toast.error(data.error || 'Could not save')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setSaving(false)
  }

  async function addToPhone() {
    if (!form.name.trim()) { toast.error('Add a name first'); return }
    const r = await saveToPhone({
      name: form.name, title: form.title, company: form.company,
      email: form.email, phone: form.phone, website: form.website, address: form.address,
    })
    if (r.ok) {
      toast.success(r.method === 'native' ? 'Added to your phone contacts' : 'Contact downloaded — open it to add')
    } else if (r.reason === 'denied') {
      toast.error('Contacts permission denied')
    } else {
      toast.error('Could not add to phone')
    }
  }

  const fields: { key: keyof Parsed; label: string; icon: React.ReactNode; type?: string; placeholder: string }[] = [
    { key: 'name',    label: 'Name',    icon: <User className="w-4 h-4" />,      placeholder: 'Full name' },
    { key: 'title',   label: 'Title',   icon: <Briefcase className="w-4 h-4" />, placeholder: 'Job title' },
    { key: 'company', label: 'Company', icon: <Building2 className="w-4 h-4" />,  placeholder: 'Company' },
    { key: 'email',   label: 'Email',   icon: <Mail className="w-4 h-4" />,      type: 'email', placeholder: 'name@company.com' },
    { key: 'phone',   label: 'Phone',   icon: <Phone className="w-4 h-4" />,     type: 'tel', placeholder: 'Phone number' },
    { key: 'website', label: 'Website', icon: <Globe className="w-4 h-4" />,     placeholder: 'company.com' },
    { key: 'address', label: 'Address', icon: <MapPin className="w-4 h-4" />,    placeholder: 'Postal address' },
  ]

  return (
    <div className="max-w-xl mx-auto">
      {/* Hidden camera/file input - capture=environment opens the rear camera on mobile */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />

      {stage === 'capture' && (
        <div className="text-center">
          <div className="rounded-3xl border-2 border-dashed p-10 mb-6"
            style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <ScanLine className="w-8 h-8" style={{ color: '#a78bfa' }} />
            </div>
            <h2 className="text-lg font-bold mb-1">Scan a paper business card</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Snap a photo of someone&apos;s card and we&apos;ll pull out their details, ready to save to your contacts or your phone.
            </p>
            <button onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition hover:scale-[1.02]"
              style={{ background: grad, boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
              <Camera className="w-4 h-4" />Take a photo
            </button>
            <p className="text-xs text-muted-foreground mt-3">or choose an image from your device</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: lay the card flat, fill the frame, and avoid glare for the best read.
          </p>
        </div>
      )}

      {stage === 'scanning' && (
        <div className="text-center py-6">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Scanning" className="w-full max-w-sm mx-auto rounded-2xl mb-6 border border-border" />
          )}
          <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#a78bfa' }} />
            Reading the card...
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Scanned card" className="w-full max-w-xs mx-auto rounded-2xl mb-5 border border-border" />
          )}
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Check the details below, fix anything, then save.
          </p>

          <div className="space-y-3 mb-6">
            {fields.map(({ key, label, icon, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring transition">
                  <span className="text-muted-foreground flex-shrink-0">{icon}</span>
                  <input
                    type={type || 'text'}
                    value={form[key]}
                    onChange={e => update(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={saveToContacts} disabled={saving || saved}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: grad }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {saved ? 'Saved to Contacts' : 'Save to Contacts'}
            </button>
            <button onClick={addToPhone}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-border transition hover:bg-muted">
              <Smartphone className="w-4 h-4" />Add to phone
            </button>
          </div>

          <button onClick={reset}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition">
            <RotateCcw className="w-4 h-4" />Scan another card
          </button>
        </div>
      )}
    </div>
  )
}
