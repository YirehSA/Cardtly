'use client'

import { useState } from 'react'
import { Sparkles, X, RefreshCw, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  onAccept: (bio: string) => void
  // Pre-fill from the existing form so the AI has context.
  initial: {
    role?: string
    company?: string
    bio?: string
  }
}

type Tone = 'professional' | 'friendly' | 'bold'

// Modal that asks the user a few questions then calls the OpenAI-
// backed /api/ai/bio endpoint to draft a card bio. The user can
// regenerate as many times as they want, edit in-line before
// accepting, then commit to the form. Closing without accepting
// discards the draft.

export default function AIBioModal({ open, onClose, onAccept, initial }: Props) {
  const [role, setRole] = useState(initial.role || '')
  const [company, setCompany] = useState(initial.company || '')
  const [expertise, setExpertise] = useState('')
  const [location, setLocation] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role, company, expertise, location, tone,
          existing_bio: initial.bio || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not generate')
        setLoading(false)
        return
      }
      setDraft(data.bio || '')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function accept() {
    if (!draft.trim()) return
    onAccept(draft.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden border shadow-2xl"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))' }}>
              <Sparkles className="w-4 h-4" style={{ color: '#00d4ff' }} />
            </div>
            <div>
              <h2 className="font-bold text-base">AI bio writer</h2>
              <p className="text-xs text-muted-foreground">A few quick details, get a polished bio</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {!draft ? (
            <>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Your role</label>
                <input value={role} onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Real estate agent"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Company (optional)</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. C-Office"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">What do you specialise in?</label>
                <input value={expertise} onChange={(e) => setExpertise(e.target.value)}
                  placeholder="e.g. luxury homes in Cape Town suburbs"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Where are you based (optional)</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Cape Town"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['professional', 'friendly', 'bold'] as Tone[]).map((t) => (
                    <button key={t} onClick={() => setTone(t)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition ${tone === t ? 'border-2 border-primary bg-primary/10 text-primary' : 'border border-border hover:border-foreground/20'}`}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Draft (edit if you want)</label>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none" />
              <p className="text-xs text-muted-foreground mt-1.5">{draft.length} chars</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          {draft && (
            <button onClick={generate} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-border hover:bg-muted transition disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Regenerate
            </button>
          )}
          {!draft ? (
            <button onClick={generate} disabled={loading || (!role.trim() && !expertise.trim())}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate bio
            </button>
          ) : (
            <button onClick={accept} disabled={!draft.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <Check className="w-4 h-4" />
              Use this bio
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
