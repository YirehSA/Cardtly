import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ClipboardList, ArrowRight, Users, User } from 'lucide-react'
import PageHeader from '@/components/dashboard/PageHeader'
import { resolveAddonTargets, mergeTeamAddons } from '@/lib/addon-target'
import { getUserPlan } from '@/lib/plan-server'
import { isIosApp } from '@/lib/app-platform'
import { extractLinks } from '@/types/database'
import { parseDesign, templateOffersBooking, IMAGE_SLOTS, SOCIAL_SLOTS } from '@/types/design'
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
      <div className="max-w-4xl mx-auto space-y-5 stagger pb-16">
        <PageHeader
          eyebrow="Cardtly Context"
          title="One card, the right first impression"
          subtitle="Arrange what a visitor sees based on who they are."
        />
        <div className="panel max-w-xl mx-auto p-8 text-center">
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
      <div className="max-w-4xl mx-auto space-y-5 stagger pb-16">
        <PageHeader
          eyebrow="Cardtly Context"
          title="One card, the right first impression"
          subtitle="Arrange what a visitor sees based on who they are."
        />
        <div className="panel max-w-xl mx-auto p-8 text-center">
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
  // The photos and social accounts this card actually has, named so the
  // pickers can offer them. Left empty for an organisation, where photo 2 and
  // the TikTok account are different on every member's card and the picker
  // offers them by number and platform instead.
  let galleryItems: { id: number; label: string }[] = []
  let socialItems: { id: string; label: string }[] = []
  let populated: Record<ContextSection, boolean> = { certifications: true, links: true, gallery: true }
  let sourceRow: any = null
  if (selected.table === 'cards' || selected.table === 'team_cards') {
    const { data: row } = await admin.from(selected.table).select('*').eq('id', selected.id).maybeSingle()
    if (row) {
      const r = row as any
      sourceRow = r
      links = extractLinks(r).map(l => ({ index: l.index, title: l.title }))
      galleryItems = IMAGE_SLOTS
        .filter(i => !!r[`image_${i}_url`])
        .map(i => ({ id: i, label: `Photo ${i}` }))
      socialItems = SOCIAL_SLOTS
        .filter(sl => !!r[sl.column])
        .map(sl => ({ id: sl.key as string, label: sl.label }))
      populated = {
        links: links.length > 0,
        certifications: !!(typeof r.certifications === 'string' && r.certifications.trim()),
        // Counted off IMAGE_SLOTS. This said [1,2,3,4,5,6] while the card has
        // ten, so an owner whose only photos were in slots 7 to 10 was told
        // their gallery was empty - the exact failure the comment above
        // IMAGE_SLOTS describes, in the editor this time rather than the card.
        gallery: IMAGE_SLOTS.some(i => !!r[`image_${i}_url`]),
      }
    }
  }

  // WHETHER A BOOKING CTA CAN ACTUALLY RENDER ON THIS CARD.
  //
  // This was hardcoded to true, with a comment reasoning that the public card
  // "handles it by rendering nothing". The card does. The editor did not: on
  // Circuit, which draws its own booking control and so omits the shared one,
  // an owner could choose a booking CTA, type wording for it, read it back in
  // the summary as though it were live, and get no button at all. Exactly the
  // failure the empty-link-slot warning exists to prevent, missed for booking.
  //
  // An organisation runs the same Context across members who may be on
  // different templates, so there is no single answer there and the picker says
  // so rather than guessing.
  const bookingAvailable = selected.table === 'organizations'
    ? true
    : templateOffersBooking(parseDesign(sourceRow?.color_theme).templateId)

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

  const enabledCount = stored.config.audiences.filter(a => a.enabled).length

  return (
    <div className="max-w-6xl mx-auto space-y-5 stagger pb-16 ctx-aurora">
      {/* The house header, not a hand-rolled one. Every other dashboard page
          gets its size, spacing, accent wash and rule from here; this page was
          writing its own h1 and reading as the one screen nobody designed. */}
      <PageHeader
        eyebrow="Cardtly Context"
        title="One card, the right first impression"
        subtitle="Arrange what a visitor sees based on who they are. An IT manager and a finance director open the same link and each lands on what matters to them."
        meta={
          <>
            <StatusChip on={stored.enabled} />
            {stored.enabled && (
              <span className="stat-chip">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {enabledCount} audience{enabledCount === 1 ? '' : 's'} live
              </span>
            )}
            <span className="stat-chip">
              {isTeamWide ? <Users className="w-3 h-3" aria-hidden="true" /> : <User className="w-3 h-3" aria-hidden="true" />}
              {isTeamWide ? 'Whole team' : 'Personal card'}
            </span>
          </>
        }
        actions={
          <Link href="/dashboard/questionnaire"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-semibold transition hover:bg-muted/50 min-h-11">
            <ClipboardList className="w-4 h-4" aria-hidden="true" />
            Lead capture
          </Link>
        }
      />

      {/* NOT LIVE YET. Informational, never an error, and it does not stop
          anything: configure and save today, it starts working the day Cardtly
          turns the feature on. Reads the constant so it removes itself at
          launch rather than being remembered. */}
      {!CONTEXT_ENABLED && (
        <div className="panel p-4 flex items-start gap-3 overflow-hidden relative">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1"
            style={{ background: 'linear-gradient(180deg,#00d4ff,#7c3aed)' }} />
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 ml-1.5" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">Context is in beta.</span>{' '}
            Set everything up and save it now. Personalised Context is not live on public cards yet,
            so visitors currently see your normal card.
          </p>
        </div>
      )}

      {allTargets.length > 1 && (
        <div className="panel p-4">
          <p className="section-label mb-2.5">Which card are you setting up?</p>
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

      {/* Said even with a single target: the scope of a setting should not
          depend on how many cards you happen to own. */}
      {allTargets.length === 1 && (
        <p className="text-xs text-muted-foreground px-1">
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
        galleryItems={galleryItems}
        socialItems={socialItems}
        bookingAvailable={bookingAvailable}
        populated={populated}
        isOrg={isTeamWide}
        teamWide={isTeamWide}
        beta={!CONTEXT_ENABLED}
        previewCards={previewCards}
        cardSlug={selected.table === 'organizations' ? null : (sourceRow?.slug ?? null)}
      />
    </div>
  )
}

/** On or off, said in words and shape rather than colour alone. */
function StatusChip({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border"
      style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#16a34a' }}>
      <span aria-hidden="true" className="status-online w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: '#22c55e' }} />
      Context is on
    </span>
  ) : (
    <span className="stat-chip">Context is off</span>
  )
}

