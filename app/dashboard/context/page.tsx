import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ClipboardList, ArrowLeft } from 'lucide-react'
import { resolveAddonTargets, mergeTeamAddons } from '@/lib/addon-target'
import { getUserPlan } from '@/lib/plan-server'
import { isIosApp } from '@/lib/app-platform'
import { extractLinks } from '@/types/database'
import ContextEditor from '@/components/context/ContextEditor'
import TargetLink from '@/components/context/TargetLink'
import { CONTEXT_ENABLED, readStoredContext, type ContextSection } from '@/lib/card-context'

export const metadata = { title: 'Cardtly Context' }

// THE OWNER'S CONFIGURATION SCREEN FOR CARDTLY CONTEXT.
//
// READS readStoredContext, NEVER readCardContext, and the difference is the
// whole reason this page can exist yet. readCardContext honours the platform
// switch and returns nothing while Context is unreleased, which is correct for
// a public card and useless for a configuration screen. The owner has to be
// able to see and set up their audiences before the day we turn the feature
// on, not after it.
//
// It also means a DISABLED AUDIENCE STILL APPEARS HERE with everything it was
// configured with. On the public card a disabled audience does not exist; in
// here it is a switch that happens to be off. Those are two readings of one
// stored object, which is exactly what the Task 9b model was built for, and
// this page is the first place the difference is visible.

export default async function ContextPage({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  const { target: targetParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const [plan, allTargets, iosApp] = await Promise.all([
    getUserPlan(user.id),
    resolveAddonTargets(admin, user.id),
    isIosApp(),
  ])
  const isPro = plan.tier === 'pro' && plan.isActive

  const keyOf = (t: { table: string; id: string }) => `${t.table}:${t.id}`
  const selected = allTargets.find(t => keyOf(t) === targetParam) || allTargets[0] || null
  const selKey = selected ? keyOf(selected) : ''
  const isTeamWide = !!selected?.isOrg

  if (!isPro) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="max-w-xl mx-auto rounded-lg border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-lg mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <Sparkles className="w-7 h-7" style={{ color: 'hsl(var(--accent))' }} />
          </div>
          <h2 className="font-bold text-lg mb-2">Context is a Pro feature</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Personalising your card for different audiences comes with Pro, and you set it up yourself.
          </p>
          {!iosApp && (
            <Link href="/dashboard/upgrade"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'hsl(var(--accent))' }}>
              Subscribe for R97/month
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="max-w-xl mx-auto rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="font-bold text-lg mb-2">No card yet</h2>
          <p className="text-sm text-muted-foreground">Create your card first and this page will configure it.</p>
        </div>
      </div>
    )
  }

  const stored = readStoredContext(selected.addons)

  // WHAT THE EDITOR NEEDS TO KNOW ABOUT THE ACTUAL CARD.
  //
  // A CTA points at a link SLOT, link_3, not at a URL, so what it says depends
  // on the card it renders on. For one card we can read that card's slots and
  // offer them by name. For an ORGANISATION the same configuration runs on
  // every team card, each with their own slot 3, so there is no single title to
  // offer and the editor says so instead of picking one card's.
  //
  // `populated` is the same idea for sections: the editor should let somebody
  // arrange a gallery they have not built yet, while being honest that nothing
  // will show until they do.
  let links: { index: number; title: string }[] = []
  let populated: Record<ContextSection, boolean> = { certifications: true, links: true, gallery: true }
  let sourceRow: any = null
  if (selected.table === 'cards' || selected.table === 'team_cards') {
    const { data: row } = await admin.from(selected.table).select('*').eq('id', selected.id).maybeSingle()
    if (row) {
      const r = row as any
      sourceRow = r
      links = extractLinks(r).map(l => ({ index: l.index, title: l.title }))
      populated = {
        links: links.length > 0,
        certifications: !!(typeof r.certifications === 'string' && r.certifications.trim()),
        gallery: [1, 2, 3, 4, 5, 6].some(i => !!r[`image_${i}_url`]),
      }
    }
  }

  // Booking is offered on any Pro card; a template can omit it, which the
  // public card handles by rendering nothing rather than by disabling it here.
  const bookingAvailable = true

  // WHICH CARD THE PREVIEW RENDERS.
  //
  // For a personal target it is obvious: that card. For an ORGANISATION it is
  // not, and getting it wrong would mislead the one person most likely to act
  // on it. The same Context runs on every member's card, and link 3 is
  // Corporate Pricing on one and Website on another, so a generic organisation
  // card would show a CTA going somewhere that belongs to nobody. Preview
  // against real team cards and name whose is on screen.
  let previewCards: { id: string; label: string; card: Record<string, any> }[] = []
  if (selected.table === 'organizations') {
    const { data: teamRows } = await admin
      .from('team_cards').select('*').eq('organization_id', selected.id)
      .order('created_at', { ascending: true }).limit(12)
    previewCards = (teamRows || []).map((r: any) => ({
      id: r.id,
      label: `${r.name || 'Team member'}'s Cardtly`,
      // REAL add-ons, with the organisation's laid over the card's exactly as
      // the public runtime does, so contact exchange and the questionnaire
      // appear in the preview if they would appear on the card. The `context`
      // inside is never read here: previewContext short-circuits the public
      // reader entirely, which is what keeps the kill switch untouched.
      card: { ...r, addons: mergeTeamAddons(r.addons, selected.addons), _team_card_id: r.id },
    }))
  } else if (sourceRow) {
    previewCards = [{
      id: sourceRow.id,
      label: isTeamWide ? `${sourceRow.name || 'This'} Cardtly` : 'Your Cardtly',
      card: { ...sourceRow, addons: sourceRow.addons || {} },
    }]
  }

  const targetLabel = isTeamWide
    ? `${selected.label || 'your team'} (every card in the team)`
    : (selected.label || 'your personal card')

  return (
    <div className="space-y-6">
      <Header />

      {/* CONTEXT IS NOT LIVE YET. Informational, not an error, and it does not
          stop anything: the owner can configure and save today and it starts
          working the day Cardtly turns the feature on. Reads the constant so
          this notice removes itself at launch rather than being remembered. */}
      {!CONTEXT_ENABLED && (
        <div className="rounded-lg border p-4 flex items-start gap-3"
          style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)' }}>
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#3b82f6' }} aria-hidden="true" />
          <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--foreground))' }}>
            <span className="font-semibold">Context is in beta.</span>{' '}
            You can set everything up and save it now. Personalised Context is not live on public cards yet,
            so visitors currently see your normal card.
          </p>
        </div>
      )}

      {allTargets.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Which card are you setting up?</p>
          <div className="flex flex-wrap gap-2">
            {allTargets.map(t => (
              <TargetLink
                key={keyOf(t)}
                href={`/dashboard/context?target=${encodeURIComponent(keyOf(t))}`}
                label={t.label || (t.isOrg ? 'Team' : 'Card')}
                isOrg={!!t.isOrg}
                active={keyOf(t) === selKey}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2.5">
            {isTeamWide
              ? 'These Context settings apply to every Cardtly in your team.'
              : 'These Context settings apply to your personal Cardtly only.'}
          </p>
        </div>
      )}

      {/* Said again even with a single target, because the scope of a setting
          should not depend on how many cards you happen to own. */}
      {allTargets.length === 1 && (
        <p className="text-xs text-muted-foreground">
          {isTeamWide
            ? 'These Context settings apply to every Cardtly in your team.'
            : 'These Context settings apply to your personal Cardtly only.'}
        </p>
      )}

      <ContextEditor
        key={selKey}
        target={{ table: selected.table, id: selected.id }}
        targetLabel={targetLabel}
        enabled={stored.enabled}
        audiences={stored.config.audiences}
        defaultAudience={stored.config.defaultAudience}
        links={links}
        bookingAvailable={bookingAvailable}
        populated={populated}
        isOrg={isTeamWide}
        teamWide={isTeamWide}
        beta={!CONTEXT_ENABLED}
        previewCards={previewCards}
      />

      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <ClipboardList className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
          <p className="text-sm font-semibold">Lead capture</p>
        </div>
        <Link href="/dashboard/questionnaire"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition min-h-11"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Lead capture
        </Link>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold flex items-center gap-2">
        <Sparkles className="w-6 h-6" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
        Cardtly Context
      </h1>
      <p className="text-muted-foreground text-sm mt-0.5">
        Personalise your digital business card for different types of visitors.
      </p>
    </div>
  )
}
