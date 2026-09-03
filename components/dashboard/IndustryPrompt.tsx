'use client'

import { useState } from 'react'
import { Network, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { INDUSTRIES_BY_GROUP } from '@/lib/industries'

interface Props {
  cardId: string
  isTeamCard: boolean
  accentHex: string
}

// Shown on the dashboard only while the card has no industry set.
//
// The field lives in Settings too, but nobody goes to Settings to fill in
// something they have never heard of, and an empty industry means the person
// cannot be found by niche in the Network. So it gets asked for once, here,
// where people actually are - and then it goes away. It is deliberately not
// part of the card-completeness checklist next to it: everything on that list
// renders on the card, industry does not, and folding it in would drop every
// finished user from 100% to 86% for a field that changes nothing about how
// their card looks.
export default function IndustryPrompt({ cardId, isTeamCard, accentHex }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function save(next: string) {
    setValue(next)
    if (!next) return
    setSaving(true)
    // Select a row back rather than trusting a missing error: an update that
    // matches nothing reports success and saves nothing.
    // Cast because industry is not in the generated database.ts types yet -
    // the documented noise for columns added by hand, not a real error.
    const { data, error } = await (supabase as any)
      .from(isTeamCard ? 'team_cards' : 'cards')
      .update({ industry: next, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .select('id')
    setSaving(false)
    if (error || !data?.length) {
      setValue('')
      toast.error('Could not save that' + (error ? ': ' + error.message : ''))
      return
    }
    setSaved(true)
    toast.success('You can now be found by industry in the Network')
  }

  if (saved) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="w-4 h-4 shrink-0" style={{ color: accentHex }} aria-hidden="true" />
          Saved. You will show up when people filter the Network by your industry.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className="w-11 h-11 rounded-lg grid place-items-center shrink-0"
          style={{ background: `${accentHex}1f`, color: accentHex }}
        >
          <Network className="w-5 h-5" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm">What industry are you in?</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            So people searching the Network by industry can find you. Takes a second.
          </p>
        </div>

        <div className="sm:w-64 shrink-0">
          <label htmlFor="dash-industry" className="sr-only">
            Choose your industry
          </label>
          <select
            id="dash-industry"
            value={value}
            onChange={e => save(e.target.value)}
            disabled={saving}
            className="w-full min-h-[44px] px-3 rounded-xl border border-border bg-background text-sm disabled:opacity-50"
          >
            <option value="">{saving ? 'Saving...' : 'Choose your industry'}</option>
            {INDUSTRIES_BY_GROUP.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(i => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
