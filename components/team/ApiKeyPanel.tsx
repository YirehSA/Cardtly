'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Copy, X, KeyRound, Ban } from 'lucide-react'

// A team's API keys.
//
// The key is shown once, at the moment it is created, and never again -
// nothing stores it and no route can return it. That is worth saying plainly
// on screen, because the alternative is somebody closing the panel and
// assuming they can come back for it.

type Key = {
  id: string; name: string; preview: string; permissions: string[]
  is_active: boolean; last_used_at: string | null; usage_count: number
  rate_limit_per_hour: number; created_at: string
}

const BASE = typeof window !== 'undefined' ? window.location.origin : 'https://cardtly.com'

export default function ApiKeyPanel({ orgId }: { orgId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [keys, setKeys] = useState<Key[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/team/api-keys?org_id=${orgId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setUnavailable(data?.error || 'Could not load API keys'); setLoaded(true); return }
    setKeys(data.keys || [])
    setLoaded(true)
  }
  useEffect(() => { load() }, [orgId])

  async function call(key: string, body: object): Promise<any> {
    setBusy(key)
    const res = await fetch('/api/team/api-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, ...body }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return null }
    return data
  }

  if (!loaded) {
    return <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />Loading API keys
    </div>
  }
  if (unavailable) {
    return <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{unavailable}</div>
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <KeyRound className="w-5 h-5 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-bold text-sm">API access</h2>
          <p className="text-xs text-muted-foreground">
            Read your leads, cards and structure from your own systems.
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition">
            <Plus className="w-3.5 h-3.5" />New key
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="What is it for? e.g. BluWave sync"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <div className="flex gap-2">
            <button disabled={busy === 'create'}
              onClick={async () => {
                const data = await call('create', { action: 'create', name })
                if (data) { setFresh(data.key); setName(''); setAdding(false); load() }
              }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
            <button onClick={() => { setAdding(false); setName('') }}
              className="px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>
          </div>
        </div>
      )}

      {fresh && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
            Copy this now. It is never shown again, and we cannot recover it.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono break-all flex-1">{fresh}</code>
            <button title="Copy" onClick={() => { navigator.clipboard?.writeText(fresh); toast.success('Copied') }}
              className="p-1.5 rounded-lg hover:bg-muted"><Copy className="w-3.5 h-3.5" /></button>
            <button title="Hide" onClick={() => setFresh(null)}
              className="p-1.5 rounded-lg hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {keys.length === 0 && !adding && <p className="text-sm text-muted-foreground">No keys yet.</p>}

      {keys.map(k => (
        <div key={k.id} className="rounded-xl border border-border p-3 flex items-start gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {k.name}
              {!k.is_active && <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Revoked</span>}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{k.preview}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {k.last_used_at
                ? `Last used ${new Date(k.last_used_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'Never used'}
              {' · '}{k.rate_limit_per_hour} requests an hour
            </p>
          </div>
          <div className="flex gap-1">
            {k.is_active && (
              <button title="Revoke" disabled={busy === `r-${k.id}`}
                onClick={async () => {
                  if (!confirm(`Revoke "${k.name}"?\n\nAnything using this key stops working immediately.`)) return
                  if (await call(`r-${k.id}`, { action: 'revoke', key_id: k.id })) load()
                }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Ban className="w-3.5 h-3.5" /></button>
            )}
            <button title="Delete" onClick={async () => {
              if (!confirm(`Delete "${k.name}" and its usage history?`)) return
              if (await call(`d-${k.id}`, { action: 'delete', key_id: k.id })) load()
            }}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground">How to use it</summary>
        <pre className="mt-2 p-3 rounded-lg bg-muted overflow-x-auto text-[11px] leading-relaxed">{`curl -H "Authorization: Bearer ck_..." \\
  ${BASE}/api/v1/leads?since=2026-08-01T00:00:00Z

GET /api/v1/leads         every lead, oldest first
GET /api/v1/cards         every card, with its department and company
GET /api/v1/departments   the group structure

Page with ?since= and the next_since you get back,
not an offset: a lead captured mid-sync would
otherwise be skipped.`}</pre>
      </details>
    </div>
  )
}
