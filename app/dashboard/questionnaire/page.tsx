import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuestionnaireBuilder from '@/components/questionnaire/QuestionnaireBuilder'
import CardFeatureToggles from '@/components/questionnaire/CardFeatureToggles'
import { resolveAddonTargets } from '@/lib/addon-target'
import { getUserPlan } from '@/lib/plan-server'
import { isIosApp } from '@/lib/app-platform'
import { ClipboardList, User, Users, Sparkles } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Lead capture' }

const grad = 'hsl(var(--accent))'

// Turn a target's addons into the library the builder edits. Prefer the
// new multi-form shape; fall back to wrapping a single legacy form.
function deriveLibrary(addons: Record<string, any>) {
  let library = Array.isArray(addons.questionnaires) ? addons.questionnaires : null
  if (!library) {
    const single = addons.questionnaire
    // Spread, not a field list. Naming them here would drop the button
    // colours off any card still on the legacy single-form shape - the same
    // way the live mirror dropped them.
    library = single && Array.isArray(single.questions) && single.questions.length
      ? [{ id: 'form_1', ...single }]
      : []
  }
  const activeId = addons.activeQuestionnaireId || library[0]?.id || null
  return { library, activeId }
}

export default async function LeadCapturePage({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
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

  // Every target is offered now. These used to be filtered to the ones an
  // admin had granted the add-on on, which is what made a paying customer
  // email and ask for a feature they were already paying for.
  const keyOf = (t: { table: string; id: string }) => `${t.table}:${t.id}`
  const selected = allTargets.find(t => keyOf(t) === targetParam) || allTargets[0] || null
  const selKey = selected ? keyOf(selected) : ''

  const isTeamWide = !!selected?.isOrg
  const { library, activeId } = selected ? deriveLibrary(selected.addons) : { library: [] as any[], activeId: null as string | null }

  // Forms that already exist on the user's OTHER cards, so one built for the
  // team can be reused on a personal card and the other way round without
  // typing it out twice.
  //
  // Offered as a copy rather than a live link on purpose. Sharing one form
  // across targets would mean every read - the public card, the submit
  // handler, the contact export - resolving a reference and deciding what to
  // do when the source is deleted or the user loses access to it. A copy is
  // understandable from the UI alone: you can see which form is on which card,
  // and editing one never silently changes another.
  const importable = allTargets
    .filter(t => keyOf(t) !== selKey)
    .map(t => ({ label: t.label || (t.isOrg ? 'Team' : 'Card'), forms: deriveLibrary(t.addons).library }))
    .filter(t => t.forms.length > 0)
  const questionnaireOn = !!selected?.addons?.questionnaireEnabled

  // Not Pro: nothing to configure, so say so plainly rather than pretend.
  if (!isPro) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="max-w-xl mx-auto rounded-lg border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-lg mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <Sparkles className="w-7 h-7" style={{ color: 'hsl(var(--accent))' }} />
          </div>
          <h2 className="font-bold text-lg mb-2">Lead capture is a Pro feature</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            The contact exchange popup and the custom questionnaire both come with Pro, and you switch them on yourself. Nothing to request.
          </p>
          {/* No price and no way to buy inside the iOS app - Guideline 3.1.1
              treats the button as the violation, not just the checkout. */}
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

  return (
    <div className="space-y-6">
      <Header />

      {/* Target switcher - only when you can manage more than one place */}
      {allTargets.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Which card are you setting up?</p>
          <div className="flex flex-wrap gap-2">
            {allTargets.map(t => {
              const active = keyOf(t) === selKey
              return (
                <Link key={keyOf(t)} href={`/dashboard/questionnaire?target=${encodeURIComponent(keyOf(t))}`}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition"
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
              ? 'These settings apply to every card in your team (not your personal card).'
              : 'These settings apply to your personal card only (not your team cards).'}
            {' '}Switching loads that card&apos;s own setup; save before you switch.
          </p>
        </div>
      )}

      {/* contactExchange reads !== false, matching PublicCardView: it is on by
          default, and this toggle has to show what the card is actually doing. */}
      <CardFeatureToggles
        key={selKey}
        target={{ table: selected.table, id: selected.id }}
        contactExchange={selected.addons?.contactExchange !== false}
        cardtlyBadge={selected.addons?.cardtlyBadge !== false}
        questionnaireEnabled={questionnaireOn}
        teamWide={isTeamWide}
      />

      {/* The builder stays available while the questionnaire is off, so you
          can write the form first and switch it on when it is ready. */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* Name the target here, not only in the switcher at the top of the
              page. The switcher scrolls out of sight, and everything below it
              looked identical whichever card was selected - so it was possible
              to set the button colours on the team, save, open a personal card,
              and see no change with nothing anywhere explaining why. */}
          <h2 className="font-display text-lg font-bold flex items-center gap-2 flex-wrap">
            <ClipboardList className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} />
            Your forms
            {allTargets.length > 1 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-muted-foreground"
                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
                {isTeamWide ? `for ${selected.label || 'your team'} (every team card)` : `for ${selected.label || 'your card'} only`}
              </span>
            )}
          </h2>
          {!questionnaireOn && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
              Questionnaire is off, nothing shows on your card yet
            </span>
          )}
        </div>
        <QuestionnaireBuilder
          key={selKey}
          initial={{ questionnaires: library, activeId }}
          teamWide={isTeamWide}
          target={{ table: selected.table, id: selected.id }}
          targetLabel={allTargets.length > 1
            ? (isTeamWide ? `${selected.label || 'your team'} (every team card)` : (selected.label || 'your card'))
            : undefined}
          importable={importable}
        />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="w-6 h-6" style={{ color: 'hsl(var(--accent))' }} />
        Lead capture
      </h1>
      <p className="text-muted-foreground text-sm mt-0.5">
        What your card asks visitors for. Build up to 3 forms (5 questions each) and choose which one is live.
      </p>
    </div>
  )
}
