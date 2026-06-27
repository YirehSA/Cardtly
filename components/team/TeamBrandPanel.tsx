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

      <button onClick={syncFromCard} disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {hasBrand ? 'Update team brand from my card' : 'Set team brand from my card'}
      </button>

      <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
        Your team brand is taken from your own card: logo, company, website, address, colours, template, fonts, social links, custom links, certifications, and gallery. To change it, edit those on
        {' '}<a href="/dashboard/card" className="underline hover:text-foreground">your card</a>{' '}
        then click the button above - every team card updates instantly. Team members only edit their own name, title, contact details, photo, and bio.
      </p>
    </div>
  )
}
