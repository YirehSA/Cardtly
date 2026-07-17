import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuestionnaireBuilder from '@/components/questionnaire/QuestionnaireBuilder'
import CardFeatureToggles from '@/components/questionnaire/CardFeatureToggles'
import { resolveAddonTargets } from '@/lib/addon-target'
import { getUserPlan } from '@/lib/plan-server'
import { ClipboardList, User, Users, Sparkles } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Lead capture' }

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

// Turn a target's addons into the library the builder edits. Prefer the
// new multi-form shape; fall back to wrapping a single legacy form.
function deriveLibrary(addons: Record<string, any>) {
  let library = Array.isArray(addons.questionnaires) ? addons.questionnaires : null
  if (!library) {
    const single = addons.questionnaire
    library = single && Array.isArray(single.questions) && single.questions.length
      ? [{ id: 'form_1', title: single.title, questions: single.questions }]
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

  const [plan, allTargets] = await Promise.all([
    getUserPlan(user.id),
    resolveAddonTargets(admin, user.id),
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
  const questionnaireOn = !!selected?.addons?.questionnaireEnabled

  // Not Pro: nothing to configure, so say so plainly rather than pretend.
  if (!isPro) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <Sparkles className="w-7 h-7" style={{ color: '#a855f7' }} />
          </div>
          <h2 className="font-bold text-lg mb-2">Lead capture is a Pro feature</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            The contact exchange popup and the custom questionnaire both come with Pro, and you switch them on yourself. Nothing to request.
          </p>
          <Link href="/dashboard/upgrade"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: grad }}>
            Subscribe for R97/month
          </Link>
        </div>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center">
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
        <div className="rounded-2xl border border-border bg-card p-4">
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

      <CardFeatureToggles
        key={selKey}
        target={{ table: selected.table, id: selected.id }}
        contactExchange={!!selected.addons?.contactExchange}
        questionnaireEnabled={questionnaireOn}
        teamWide={isTeamWide}
      />

      {/* The builder stays available while the questionnaire is off, so you
          can write the form first and switch it on when it is ready. */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" style={{ color: '#a855f7' }} />
            Your forms
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
        />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="w-6 h-6" style={{ color: '#a855f7' }} />
        Lead capture
      </h1>
      <p className="text-muted-foreground text-sm mt-0.5">
        What your card asks visitors for. Build up to 3 forms (5 questions each) and choose which one is live.
      </p>
    </div>
  )
}
