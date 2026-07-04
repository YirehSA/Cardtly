import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuestionnaireBuilder from '@/components/questionnaire/QuestionnaireBuilder'
import { resolveAddonTargets } from '@/lib/addon-target'
import { ClipboardList, User, Users } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Questionnaire' }

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

export default async function QuestionnairePage({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  const { target: targetParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // A team admin can ALSO have a personal card - two separate
  // questionnaires. Offer whichever they've got the add-on enabled on.
  const allTargets = await resolveAddonTargets(admin, user.id)
  const targets = allTargets.filter(t => t.addons.questionnaireEnabled)
  const enabled = targets.length > 0

  const keyOf = (t: { table: string; id: string }) => `${t.table}:${t.id}`
  const selected = targets.find(t => keyOf(t) === targetParam) || targets[0] || null
  const selKey = selected ? keyOf(selected) : ''

  const isTeamWide = !!selected?.isOrg
  const { library, activeId } = selected ? deriveLibrary(selected.addons) : { library: [] as any[], activeId: null as string | null }

  // For the "still here" note when the add-on is OFF, count saved
  // questions across every target (enabled or not).
  const savedCount = allTargets.reduce((n, t) => {
    const lib = Array.isArray(t.addons.questionnaires) ? t.addons.questionnaires : (t.addons.questionnaire ? [t.addons.questionnaire] : [])
    return n + lib.reduce((m: number, f: any) => m + (Array.isArray(f?.questions) ? f.questions.length : 0), 0)
  }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6" style={{ color: '#a855f7' }} />
          Custom questionnaire
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Build up to 3 forms (5 questions each) and choose which one is live.{isTeamWide ? ' The live form shows on every card in your team.' : ''}
        </p>
      </div>

      {enabled && selected ? (
        <>
          {/* Target switcher - only when you can manage more than one place */}
          {targets.length > 1 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2.5">Which card are you editing?</p>
              <div className="flex flex-wrap gap-2">
                {targets.map(t => {
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
                  ? 'This form shows on every card in your team (not your personal card).'
                  : 'This form shows on your personal card only (not your team cards).'}
                {' '}Switching loads that card&apos;s own forms; save before you switch.
              </p>
            </div>
          )}

          <QuestionnaireBuilder
            key={selKey}
            initial={{ questionnaires: library, activeId }}
            teamWide={isTeamWide}
            target={{ table: selected.table, id: selected.id }}
          />
        </>
      ) : (
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <ClipboardList className="w-7 h-7" style={{ color: '#a855f7' }} />
          </div>
          <h2 className="font-bold text-lg mb-2">This is a premium add-on</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            The custom questionnaire lets you collect your own questions from everyone who opens your card. Get in touch and we&apos;ll switch it on for your account.
          </p>
          {savedCount > 0 && (
            <p className="text-sm mb-6 max-w-sm mx-auto rounded-xl px-4 py-3"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
              Good news: your saved questionnaire ({savedCount} question{savedCount === 1 ? '' : 's'}) is still here. Nothing was lost. It comes straight back the moment the add-on is switched on again.
            </p>
          )}
          <Link href="/contact"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
            Enable this add-on
          </Link>
        </div>
      )}
    </div>
  )
}
