'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Copy, X, KeyRound, Ban } from 'lucide-react'
import IntegrationBrief from '@/components/team/IntegrationBrief'

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
            For your own systems to read your Cardtly data. Most teams never need this.
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

      {keys.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-border p-4 space-y-2">
          <p className="text-sm font-medium">No keys yet, and you may never need one.</p>
          {/* Answering the question an admin actually has, which is not "how
              do I authenticate" but "what is this for and is it for me". */}
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p><span className="text-foreground font-medium">You do not need this if</span> you just want leads
              to reach your CRM. Use &ldquo;Send leads to your CRM&rdquo; above instead: it pushes each lead
              the moment it arrives and needs no programming.</p>
            <p><span className="text-foreground font-medium">You do need this if</span> someone is building
              something that has to read your Cardtly data on its own schedule. For example:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>a nightly job pulling every new lead into your data warehouse or reporting</li>
              <li>your intranet or staff directory showing everyone&rsquo;s card</li>
              <li>a dashboard counting cards, views and leads across your companies</li>
              <li>an accounting or HR system that needs a current list of staff cards</li>
            </ul>
            <p>It is read-only. A key can look at your leads, cards and structure, and can change nothing.</p>
          </div>
        </div>
      )}

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

      <IntegrationBrief
        title="What to give whoever is building it"
        summary="Copy this and send it to your developer or IT team"
        mailSubject="Reading our Cardtly data"
        body={`We use Cardtly for our team's digital business cards. It has a
read-only API so our own systems can stay in step with it.

BASE
  ${BASE}

AUTHENTICATION
  Authorization: Bearer ck_...

A key is created in Cardtly under Team Cards, Integrations, API access.
It is shown once and stored only as a hash, so it cannot be recovered.
If it is lost, issue a new one and revoke the old one.

ENDPOINTS, all GET, all scoped to our organisation only
  /api/v1/leads         every lead captured by any of our cards
  /api/v1/cards         every card, with its department and company
  /api/v1/departments   our company and department structure

PAGING THE LEADS
Page by time, not by offset:

  GET /api/v1/leads?since=2026-08-01T00:00:00Z&limit=200

The response carries next_since. Pass it back as ?since= on the next
call. When fewer rows come back than the limit, you are up to date.

Offset paging would silently skip rows: a lead captured between page
one and page two shifts everything down by one, and the row crossing
the boundary is never returned. Please do not use it.

LIMITS
1000 requests an hour per key by default. Over that returns 429 with a
retry_after_seconds. Every call is logged against the key that made it,
and we can see when each key was last used.

ERRORS
  401  the key is missing, wrong, revoked or expired
  403  the key does not have that permission
  429  rate limit
  400  a malformed parameter, with a message saying which`}
      />
    </div>
  )
}
