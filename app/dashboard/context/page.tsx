import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, User, Users, ClipboardList, Check, AlertTriangle, ArrowLeft } from 'lucide-react'
import { resolveAddonTargets } from '@/lib/addon-target'
import { getUserPlan } from '@/lib/plan-server'
import { isIosApp } from '@/lib/app-platform'
import { extractLinks } from '@/types/database'
import ContextMasterToggle from '@/components/context/ContextMasterToggle'
import {
  CONTEXT_ENABLED, CONTEXT_AUDIENCE_IDS, STANDARD_SECTION_ORDER,
  readStoredContext, orderSections,
  type ContextAudience, type ContextSection,
} from '@/lib/card-context'

export const metadata = { title: 'Cardtly Context' }

const grad = 'hsl(var(--accent))'

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

/** The English name for a section, for the arrangement summary. */
const SECTION_LABEL: Record<ContextSection, string> = {
  certifications: 'Certifications',
  links: 'Links',
  gallery: 'Gallery',
}

/** Sentence case for an audience that was never configured. */
const DEFAULT_LABEL: Record<string, string> = {
  executive: 'Executive',
  it: 'IT',
  sales: 'Sales',
  marketing: 'Marketing',
  hr: 'HR',
  procurement: 'Procurement',
}

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
              style={{ background: grad }}>
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

  // THE CTA'S LINK TITLE, resolved where it can be.
  //
  // A CTA points at a link SLOT, link_3, not at a URL, so what it says depends
  // on the card it renders on. For one card we can read that card's slot 3 and
  // show what it actually is. For an ORGANISATION the same configuration runs
  // on every team card, each with their own slot 3, so naming one card's link
  // would be wrong for everybody else: the honest summary there is the slot.
  let linkTitles: Map<number, string> | null = null
  if (selected.table === 'cards' || selected.table === 'team_cards') {
    const { data: row } = await admin.from(selected.table).select('*').eq('id', selected.id).maybeSingle()
    if (row) linkTitles = new Map(extractLinks(row as any).map(l => [l.index, l.title]))
  }

  const byId = new Map(stored.config.audiences.map(a => [a.id, a]))
  const defaultAudience = stored.config.defaultAudience
    ? (byId.get(stored.config.defaultAudience)?.label || stored.config.defaultAudience)
    : null

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
            {allTargets.map(t => {
              const active = keyOf(t) === selKey
              return (
                <Link key={keyOf(t)} href={`/dashboard/context?target=${encodeURIComponent(keyOf(t))}`}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition min-h-11"
                  style={active
                    ? { borderColor: 'transparent', background: grad, color: '#fff' }
                    : { borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
                  {t.isOrg ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  {t.label}
                </Link>
              )
            })}
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

      <ContextMasterToggle
        key={selKey}
        target={{ table: selected.table, id: selected.id }}
        enabled={stored.enabled}
        audiences={stored.config.audiences}
        defaultAudience={stored.config.defaultAudience}
        teamWide={isTeamWide}
        beta={!CONTEXT_ENABLED}
      />

      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} aria-hidden="true" />
            Your audiences
          </h2>
          <span className="text-xs text-muted-foreground">
            Default audience:{' '}
            <span className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{defaultAudience || 'None'}</span>
          </span>
        </div>

        <div className="space-y-3">
          {CONTEXT_AUDIENCE_IDS.map(id => (
            <AudienceSummary
              key={id}
              id={id}
              audience={byId.get(id) || null}
              linkTitles={linkTitles}
              isOrg={isTeamWide}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Editing arrives next. This page shows what is currently saved for this card.
        </p>
      </div>

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

/**
 * One audience, exactly as it is stored.
 *
 * A DISABLED AUDIENCE SHOWS EVERYTHING IT WAS CONFIGURED WITH. The switch
 * being off is the only difference, because the promise behind the whole
 * persisted-disabled model is that switching it back on next quarter returns
 * the same card. Greying out the settings would suggest they were gone.
 */
function AudienceSummary({ id, audience, linkTitles, isOrg }: {
  id: string
  audience: ContextAudience | null
  linkTitles: Map<number, string> | null
  isOrg: boolean
}) {
  const name = DEFAULT_LABEL[id] || id

  if (!audience) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-3">
        <p className="font-semibold text-sm">{name}</p>
        <span className="text-xs text-muted-foreground">Not set up</span>
      </div>
    )
  }

  // The order a visitor would actually see, not the raw stored array: sections
  // the owner did not place keep their normal position after the ones they
  // did, which is the rule the card runs and is not obvious from the array.
  const arrangement = orderSections(STANDARD_SECTION_ORDER, { audience, source: 'default' })

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-semibold text-sm">{name}</p>
        {audience.enabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#16a34a' }}>
            <Check className="w-3 h-3" aria-hidden="true" />
            Enabled
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-muted-foreground"
            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
            Disabled
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <Row label="Label" value={audience.label} />
        <Row
          label="Content order"
          value={arrangement.length ? arrangement.map(s => SECTION_LABEL[s]).join(' → ') : 'Nothing shown'}
        />
        <Row
          label="Hidden"
          value={audience.hide.length ? audience.hide.map(s => SECTION_LABEL[s]).join(', ') : 'Nothing hidden'}
        />
        <CtaRow cta={audience.cta} linkTitles={linkTitles} isOrg={isOrg} />
      </dl>

      {!audience.enabled && (
        <p className="text-[11px] text-muted-foreground mt-2.5">
          Switched off, so visitors never see this. Everything above is kept and comes back when you switch it on.
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground w-28 flex-shrink-0">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  )
}

/**
 * The CTA in the owner's language.
 *
 * "kind: link, index: 3" is how it is stored and is no use to anybody reading
 * their own settings, so this says what the button will actually say and where
 * it will actually go. A CTA pointing at an empty slot is called out rather
 * than shown as working: resolveContextCta renders nothing in that case, and
 * a settings page that implies otherwise is worse than one that says nothing.
 */
function CtaRow({ cta, linkTitles, isOrg }: {
  cta: ContextAudience['cta']
  linkTitles: Map<number, string> | null
  isOrg: boolean
}) {
  if (!cta) return <Row label="Call to action" value="None" />

  if (cta.kind === 'booking') {
    return <Row label="Call to action" value={cta.label || 'Book a meeting'} />
  }

  // On an organisation the same slot means a different link on every team
  // card, so there is no single title to show and claiming one would be wrong.
  if (isOrg || !linkTitles) {
    return <Row label="Call to action" value={`${cta.label || `Card link ${cta.index}`} (each card's own link ${cta.index})`} />
  }

  const title = linkTitles.get(cta.index)
  if (!title) {
    return (
      <div className="flex gap-2">
        <dt className="text-muted-foreground w-28 flex-shrink-0">Call to action</dt>
        <dd className="min-w-0">
          <span className="inline-flex items-start gap-1.5" style={{ color: '#d97706' }}>
            <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
            <span>Unavailable. Link {cta.index} on this card is empty, so no button will show.</span>
          </span>
        </dd>
      </div>
    )
  }

  return <Row label="Call to action" value={cta.label ? `${cta.label} (goes to ${title})` : title} />
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
