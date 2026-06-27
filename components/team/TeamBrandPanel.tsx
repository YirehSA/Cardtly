'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Building2, Globe, Palette, Check } from 'lucide-react'

interface Brand {
  company?: string | null
  company_logo_url?: string | null
  website?: string | null
  color_theme?: string | null
}

export default function TeamBrandPanel({ orgId, brand, hasBrand }: { orgId: string; brand: Brand; hasBrand: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function syncFromCard() {
    setBusy(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_brand_from_my_card', org_id: orgId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Team brand updated from your card. All team cards now use it.')
        router.refresh()
      } else {
        toast.error(data.error || 'Could not sync')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setBusy(false)
  }

  async function applyAll(value: boolean) {
    setBusy(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_brand_to_all', org_id: orgId, value }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success(value ? 'Team brand applied to every card' : 'Every card reverted to its own branding')
        router.refresh()
      } else {
        toast.error(data.error || 'Could not update')
      }
    } catch {
      toast.error('Network error. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4 flex-wrap">
          {brand.company_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.company_logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-border bg-background flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold">{brand.company || 'No company name set'}</p>
            {brand.website && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Globe className="w-3.5 h-3.5" />{brand.website}
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Palette className="w-3.5 h-3.5" />
              {hasBrand ? 'Design, colours & links applied from your card' : 'No brand set yet'}
            </p>
          </div>
          {hasBrand && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/15 text-green-500">
              <Check className="w-3 h-3" />Live on all team cards
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={syncFromCard} disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {hasBrand ? 'Update brand from my card' : 'Set brand from my card'}
        </button>
        {hasBrand && (
          <>
            <button onClick={() => applyAll(true)} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition disabled:opacity-60">
              Apply to all cards
            </button>
            <button onClick={() => applyAll(false)} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border hover:bg-muted transition disabled:opacity-60">
              Remove from all
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
        Choose which members use the brand with the toggle on each card in Team Cards - it&apos;s off by default, so a card keeps its own branding until you switch it on. &ldquo;Apply to all&rdquo; turns it on for everyone; &ldquo;Remove from all&rdquo; reverts every card to its own branding.
        <br /><br />
        The brand is taken from your own card (logo, company, website, address, colours, template, fonts, links, certifications, gallery). Edit those on
        {' '}<a href="/dashboard/card" className="underline hover:text-foreground">your card</a>{' '}
        then click &ldquo;Update brand from my card&rdquo;. Branded members can only edit their own name, title, contact details, photo, and bio.
      </p>
    </div>
  )
}
