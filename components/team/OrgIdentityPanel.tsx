'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Link2, Loader2, Check, Briefcase } from 'lucide-react'
import { INDUSTRIES_BY_GROUP } from '@/lib/industries'
import { slugifyPart, orgSlugPrefix } from '@/lib/card-slug'

// Two company-wide settings that shape every card the team creates: the
// company half of the card URL, and the industry new cards start from.
//
// Owner only. A department head sets their own department's look, but not the
// company name that appears in every colleague's public URL.
export default function OrgIdentityPanel({
  orgId,
  orgName,
  slugPrefix,
  industry,
  cardCount,
}: {
  orgId: string
  orgName: string
  slugPrefix: string | null
  industry: string | null
  cardCount: number
}) {
  const router = useRouter()
  const [prefix, setPrefix] = useState(slugPrefix || orgSlugPrefix(orgName))
  const [ind, setInd] = useState(industry || '')
  const [saving, setSaving] = useState<string | null>(null)
  const [savedPrefix, setSavedPrefix] = useState(slugPrefix || orgSlugPrefix(orgName))

  async function save(fields: Record<string, any>, key: string, okMsg: string) {
    setSaving(key)
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_org_identity', org_id: orgId, ...fields }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(null)
    if (!res.ok || data?.error) {
      toast.error(data?.error || 'That did not work', { duration: 9000 })
      return false
    }
    toast.success(okMsg)
    router.refresh()
    return true
  }

  const clean = slugifyPart(prefix, 24)

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-muted shrink-0">
            <Link2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="font-semibold">Your card links</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Every card in the team starts with your company name, so the person only fills in their own.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center px-2.5 py-2 rounded-l-xl border border-r-0 border-border bg-muted text-xs text-muted-foreground whitespace-nowrap">
            cardtly.com/card/
          </div>
          <input
            value={prefix}
            onChange={e => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            aria-label="Company part of every card link"
            className="px-3 py-2 rounded-r-xl border border-border bg-background text-sm w-44 focus:outline-none focus:ring-1 focus:ring-ring transition"
          />
          <span className="text-xs text-muted-foreground">-john-smith</span>
          <button
            onClick={() => save({ card_slug_prefix: clean }, 'prefix', 'Company link updated').then(ok => { if (ok) setSavedPrefix(clean) })}
            disabled={saving === 'prefix' || clean.length < 2 || clean === savedPrefix}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: 'hsl(var(--accent))' }}>
            {saving === 'prefix' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Save
          </button>
        </div>

        {/* The thing people assume and would be wrong about. Changing this must
            not silently rewrite URLs that are already on printed cards. */}
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
          {clean !== savedPrefix && clean.length >= 2
            ? <>New cards will be created at <span className="font-mono text-foreground">/card/{clean}-name</span>. Your {cardCount} existing card{cardCount === 1 ? '' : 's'} keep the link they already have, so nothing printed stops working.</>
            : <>This applies to cards created from now on. Existing links never change on their own.</>}
        </p>
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-9 h-9 rounded-xl grid place-items-center bg-muted shrink-0">
            <Briefcase className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="font-semibold">Your industry</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          New cards start here instead of blank. Anyone can change their own afterwards, and it decides
          where your company sits in the Cardtly Network.
        </p>
        <select
          value={ind}
          onChange={e => { setInd(e.target.value); save({ industry: e.target.value || null }, 'industry', 'Industry saved') }}
          disabled={saving === 'industry'}
          aria-label="Company industry"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring transition">
          <option value="">Not set</option>
          {INDUSTRIES_BY_GROUP.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}
