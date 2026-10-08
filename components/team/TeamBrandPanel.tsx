'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Building2, Globe, Palette, Check, AlertCircle } from 'lucide-react'

interface Brand {
  company?: string | null
  company_logo_url?: string | null
  website?: string | null
  color_theme?: string | null
}

export default function TeamBrandPanel({ orgId, orgName, brand, hasBrand, totalCards = 0, brandedCards = 0, lookSource = null, lockedLabels = [] }: {
  orgId: string; orgName?: string | null; brand: Brand; hasBrand: boolean
  /** The cards that can wear the look: every card except the one it follows. */
  totalCards?: number; brandedCards?: number
  /** The card the look follows, if it follows one (null: a copy). */
  lookSource?: { name: string | null; own: boolean } | null
  /** Company rules, by label. */
  lockedLabels?: string[]
}) {
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
        if (data.warning) toast.warning(data.warning, { duration: 10000 })
        // Said plainly, because following and copying look identical until
        // somebody edits that card and waits to see whether anything happens.
        else if (data.linked) {
          toast.success('Team brand now follows your card.', {
            description: 'Edit your card and the change reaches every team card that has the field locked.',
            duration: 8000,
          })
        } else {
          toast.success('Team brand updated from your card. All team cards now use it.')
        }
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
    // Both directions rewrite every card in the company at once, and there is
    // no undo. "Remove from all" in particular throws away each member's
    // opt-in, which somebody then has to set again card by card.
    const n = totalCards
    // The card the look follows is never switched (it IS the look), so say so
    // rather than let "all" read as including it.
    const except = lookSource ? ` ${lookSource.own ? 'Your own card' : `${lookSource.name || 'The card'}’s card`} stays as it is: the look comes from it.` : ''
    const msg = value
      ? `Put the team brand on ${n === 1 ? 'the 1 card' : `all ${n} cards`}? What Company rules lock comes from the brand on every one of them, and the brand fills in anything they have left blank.${except}`
      : `Take the team brand off ${n === 1 ? 'the 1 card' : `all ${n} cards`}? Every card goes back to its own branding, and you will have to switch people back on one at a time.${except}`
    if (!window.confirm(msg)) return
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
      <div className="rounded-lg border border-border bg-card p-6">
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
            {/* The team's own name until a brand says otherwise. This read "No
                company name set" on a team created as JETOUR Bryanston, which
                looked like the setup had lost the name. */}
            <p className="font-bold">{brand.company || orgName || 'No company name set'}</p>
            {brand.website && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Globe className="w-3.5 h-3.5" />{brand.website}
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Palette className="w-3.5 h-3.5" />
              {!hasBrand ? 'No brand set yet'
                : lookSource ? `Follows ${lookSource.own ? 'your card' : `${lookSource.name || 'a card'}’s card`}${lookSource.own && lookSource.name ? ` (${lookSource.name})` : ''}: change it and the team changes with it`
                : 'A copy of your card, taken once. Update it after you change your card'}
            </p>
          </div>
          {/* What is actually true, rather than "Live on all team cards"
              inferred from a brand object existing. The per-card toggle is off
              by default, so a brand can be set up and worn by nobody. */}
          {hasBrand && (
            brandedCards === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500">
                <AlertCircle className="w-3 h-3" />Not on any card yet
              </span>
            ) : brandedCards === totalCards ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-500/15 text-green-500">
                <Check className="w-3 h-3" />
                Live on {totalCards === 1 ? 'the only card' : `all ${totalCards} cards`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-500">
                <Check className="w-3 h-3" />Live on {brandedCards} of {totalCards} cards
              </span>
            )
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={syncFromCard} disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: 'hsl(var(--accent))' }}>
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

      {/* Nudge when a brand exists but nothing is wearing it, which is the
          state you land in after setting one up for the first time. */}
      {hasBrand && brandedCards === 0 && totalCards > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold mb-0.5">Your brand is saved, but no card is using it</p>
          <p className="text-muted-foreground">
            Each card has its own switch and it starts off. Use &ldquo;Apply to all cards&rdquo; above, or
            turn people on one at a time in{' '}
            <a href="/dashboard/team" className="underline hover:text-foreground">Team Cards</a>.
          </p>
        </div>
      )}

      {/* THE THREE THINGS, in one place. They live on three screens (this
          one, Team Cards and Departments), and how they combine was the part
          nobody could work out: a company locked the design, the logo and the
          address, never switched the look on for anybody, and its people's
          cards kept whatever they were made with and could not be changed. */}
      {hasBrand && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <p className="font-semibold text-sm">How your team&rsquo;s cards come out</p>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: 'hsl(var(--accent))' }}>1</span>
              <div>
                <p className="font-medium">The look</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {lookSource
                    ? <>Taken from {lookSource.own ? 'your card' : `${lookSource.name || 'a card'}’s card`} and kept in step with it. Design that card the way the team should look. It always shows its own details, so it is never switched on below.</>
                    : <>A copy of your card. After you change your card, use &ldquo;Update brand from my card&rdquo; to bring the team up to date.</>}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: 'hsl(var(--accent))' }}>2</span>
              <div>
                <p className="font-medium">Who wears it: {brandedCards} of {totalCards} card{totalCards === 1 ? '' : 's'}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {brandedCards === 0
                    ? 'Nobody yet. Until a card wears the look, it keeps its own logo, colours and links. Use “Apply to all cards” above.'
                    : 'Each card has its own switch in Team Cards, for anyone who should keep their own branding.'}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: 'hsl(var(--accent))' }}>3</span>
              <div>
                <p className="font-medium">What nobody can change{lockedLabels.length ? `: ${lockedLabels.join(', ')}` : ': nothing locked'}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Only you can change a locked item, and on every card wearing the look it comes from the look.
                  The one exception is the job title: locked, it stays on each card as you set it. Anything left
                  open, each person can change their own, and the look fills in where a card is blank (never the
                  bio, which is somebody&rsquo;s own words). Set these in{' '}
                  <a href="/dashboard/departments" className="underline hover:text-foreground">Company rules</a>
                  ; a department can lock more for its own team.
                </p>
                {brandedCards === 0 && lockedLabels.length > 0 && (
                  <p className="text-xs mt-1.5 text-amber-500">
                    Locked, but nobody wears the look yet, so those cards keep what they were made with and their people cannot change it. Apply the look to fix that.
                  </p>
                )}
              </div>
            </li>
          </ol>
        </div>
      )}

      <div className="text-xs text-muted-foreground leading-relaxed max-w-lg space-y-3">
        <p>
          The brand is taken from your own card: logo, company, website, address, office number, bio, colours, template,
          fonts, links, certifications and gallery. Edit those on
          {' '}<a href="/dashboard/card" className="underline hover:text-foreground">your card</a>
          {lookSource
            ? <>; the team follows it, so there is nothing else to press.</>
            : <>{' '}then click &ldquo;Update brand from my card&rdquo;.</>}
        </p>
        <p>
          Each card has its own switch in{' '}
          <a href="/dashboard/team" className="underline hover:text-foreground">Team Cards</a>, off by
          default, so a card keeps its own branding until you turn it on.
        </p>
        <p>
          {/* This used to end "Branded members can only edit their own name, title,
              contact details, photo and bio", which was never quite right and is
              now plainly wrong: what a member may edit is decided by the locks in
              Departments, not by the brand. The brand decides what shows. */}
          A branded card <strong>displays</strong> the brand&apos;s logo, colours and links in place of
          its own. That is separate from what a member is <strong>allowed to edit</strong>, which you
          set under{' '}
          <a href="/dashboard/departments" className="underline hover:text-foreground">Departments</a>{' '}
          as company or department rules.
        </p>
      </div>
    </div>
  )
}
