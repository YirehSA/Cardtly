'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Send, Check, X, Pause, Play, Copy, Webhook } from 'lucide-react'
import IntegrationBrief from '@/components/team/IntegrationBrief'

// Where a team's leads go after Cardtly has them.
//
// The delivery log is the point of this panel as much as the form is. A
// webhook that silently stops working is the worst kind of integration: the
// CRM simply has fewer leads in it than reality, and nobody notices for a
// month. Every attempt and every refusal is on screen here.

type Hook = {
  id: string; name: string; url: string; events: string[]
  is_active: boolean; created_at: string; has_secret: boolean
}
type Delivery = {
  id: string; webhook_id: string; event_type: string
  response_status: number | null; response_body: string | null
  attempt_count: number; delivered_at: string | null
  failed_at: string | null; next_retry_at: string | null; created_at: string
}

export default function WebhookPanel({ orgId }: { orgId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [hooks, setHooks] = useState<Hook[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  // Shown once, immediately after creating. It is never readable again.
  const [freshSecret, setFreshSecret] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/team/webhooks?org_id=${orgId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setUnavailable(data?.error || 'Could not load integrations'); setLoaded(true); return }
    setHooks(data.webhooks || [])
    setDeliveries(data.deliveries || [])
    setLoaded(true)
  }
  useEffect(() => { load() }, [orgId])

  async function call(key: string, body: object): Promise<any> {
    setBusy(key)
    const res = await fetch('/api/team/webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, ...body }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok || data?.error) { toast.error(data?.error || 'That did not work', { duration: 8000 }); return null }
    return data
  }

  if (!loaded) {
    return <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />Loading integrations
    </div>
  }
  if (unavailable) {
    return <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">{unavailable}</div>
  }

  const statusOf = (d: Delivery) => {
    if (d.delivered_at) return { label: `Delivered${d.response_status ? ` (${d.response_status})` : ''}`, tone: '#22c55e' }
    if (d.failed_at) return { label: `Failed${d.response_status ? ` (${d.response_status})` : ''}`, tone: '#ef4444' }
    if (d.next_retry_at) return { label: `Retrying, attempt ${d.attempt_count}`, tone: '#f59e0b' }
    return { label: 'Queued', tone: '#94a3b8' }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Webhook className="w-5 h-5 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-bold text-sm">Send leads to your CRM</h2>
          <p className="text-xs text-muted-foreground">
            When someone shares their details with one of your cards, we can put them straight into
            your CRM. No exporting, no retyping.
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition">
            <Plus className="w-3.5 h-3.5" />Add
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-border p-3 space-y-3">
          {/* Said plainly, because the admin reading this almost certainly
              cannot produce the address themselves and will otherwise sit
              looking at an empty box wondering what goes in it. */}
          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">You need one thing to set this up: a web address from your CRM.</p>
            <p>
              Ask your CRM provider, or whoever looks after it, for
              {' '}<span className="text-foreground font-medium">the web address that receives new leads</span>.
              Most systems call it a webhook URL, an inbound endpoint, or a lead capture URL. It starts with https.
            </p>
            <p>
              If they need to know what we will send, open
              {' '}<span className="text-foreground font-medium">What to give your CRM provider</span> below and email it to them.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Name it, so you know which is which</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BluWave"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">The web address your CRM gave you</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
          </div>
          <div className="flex gap-2">
            <button disabled={!url.trim() || busy === 'create'}
              onClick={async () => {
                const data = await call('create', { action: 'create', name, url })
                if (data) { setFreshSecret(data.secret); setName(''); setUrl(''); setAdding(false); load() }
              }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
              style={{ background: 'hsl(var(--accent))' }}>
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
            <button onClick={() => { setAdding(false); setName(''); setUrl('') }}
              className="px-3 py-2 rounded-lg border border-border text-sm">Cancel</button>
          </div>
        </div>
      )}

      {freshSecret && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
            Your signing secret. Copy it now, it is not shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono break-all flex-1">{freshSecret}</code>
            <button title="Copy" onClick={() => { navigator.clipboard?.writeText(freshSecret); toast.success('Copied') }}
              className="p-1.5 rounded-lg hover:bg-muted"><Copy className="w-3.5 h-3.5" /></button>
            <button title="Hide" onClick={() => setFreshSecret(null)}
              className="p-1.5 rounded-lg hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Each request carries <span className="font-mono">X-Cardtly-Signature: sha256=…</span>, an HMAC of
            {' '}<span className="font-mono">timestamp.body</span> using this secret.
          </p>
        </div>
      )}

      {hooks.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm">
          <p className="font-medium">Nothing connected yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Leads are still captured and still show under each card. This just also pushes them
            somewhere else the moment they arrive.
          </p>
        </div>
      )}

      <IntegrationBrief
        title="What to give your CRM provider"
        summary="Copy this and send it to whoever set up your CRM"
        mailSubject="Connecting our CRM to Cardtly"
        body={`We use Cardtly for our team's digital business cards. When someone
shares their details with one of our cards, Cardtly can send that lead
straight to our CRM. We need a web address to point it at.

WHAT WE NEED FROM YOU
A URL that accepts an HTTP POST with a JSON body, over https.

WHAT CARDTLY SENDS
A POST, Content-Type: application/json, with a body like this:

{
  "event": "lead.created",
  "sent_at": "2026-08-27T10:00:05Z",
  "lead": {
    "id": "uuid",
    "name": "Thabo Nkosi",
    "email": "thabo@example.co.za",
    "phone": "082 111 2222",
    "work_phone": "021 555 0000",
    "company": "Nkosi Ltd",
    "title": "Director",
    "website": "nkosi.co.za",
    "address": "1 Main Rd",
    "message": "Please call me",
    "source": "card_form",
    "answers": null,
    "captured_at": "2026-08-27T10:00:00Z"
  },
  "card": {
    "id": "uuid", "name": "Andre Nel",
    "slug": "andre-nel", "url": "https://www.cardtly.com/card/andre-nel",
    "type": "team"
  },
  "organization": { "id": "uuid", "name": "Our Company" }
}

Fields are only ever added, never renamed, so a mapping you build now
keeps working.

HEADERS ON EVERY REQUEST
  X-Cardtly-Event      lead.created
  X-Cardtly-Delivery   a unique id for this attempt
  X-Cardtly-Timestamp  unix seconds
  X-Cardtly-Signature  sha256=<hex>

VERIFYING IT CAME FROM CARDTLY
The signature is an HMAC-SHA256 over the string:

  <X-Cardtly-Timestamp> + "." + <the raw request body>

using a shared secret we will send you separately. The timestamp is
inside the signed content, so an old request cannot be replayed with a
fresh timestamp. Please reject anything older than a few minutes.

RESPONSES
  2xx  we mark it delivered
  4xx  we do not retry, since it is a refusal
  5xx, a timeout, or no answer: we retry after 1, 5, 30 and 120 minutes

Every attempt and every response is logged on our side, so we can tell
you exactly what was sent and what came back.`}
      />

      {hooks.map(h => (
        <div key={h.id} className="rounded-xl border border-border p-3">
          <div className="flex items-start gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {h.name}
                {!h.is_active && <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Paused</span>}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate">{h.url}</p>
            </div>
            <div className="flex gap-1">
              <button title="Send a test lead" disabled={busy === `test-${h.id}`}
                onClick={async () => {
                  const data = await call(`test-${h.id}`, { action: 'test', webhook_id: h.id })
                  if (data) {
                    toast[data.delivered ? 'success' : 'error'](
                      data.delivered ? 'Test lead delivered' : 'The test could not be delivered. See the log below.')
                    load()
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                {busy === `test-${h.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
              <button title={h.is_active ? 'Pause' : 'Resume'}
                onClick={async () => { if (await call(`t-${h.id}`, { action: 'toggle', webhook_id: h.id })) load() }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                {h.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button title="Remove"
                onClick={async () => {
                  if (!confirm(`Stop sending leads to ${h.name}?\n\nLeads already captured are not affected.`)) return
                  if (await call(`d-${h.id}`, { action: 'delete', webhook_id: h.id })) load()
                }}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {deliveries.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent deliveries</p>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <tbody>
                {deliveries.map(d => {
                  const s = statusOf(d)
                  return (
                    <tr key={d.id} className="border-t border-border first:border-t-0">
                      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                        {new Date(d.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-1.5" style={{ color: s.tone }}>{s.label}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[220px]" title={d.response_body || ''}>
                        {d.response_body || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
