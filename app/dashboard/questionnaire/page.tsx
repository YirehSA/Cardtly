import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuestionnaireBuilder from '@/components/questionnaire/QuestionnaireBuilder'
import { resolveAddonTarget } from '@/lib/addon-target'
import { ClipboardList } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Questionnaire' }

export default async function QuestionnairePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Org for a team admin (one form for all team cards), else own card.
  const target = await resolveAddonTarget(admin, user.id)
  const addons = target?.addons || {}
  const enabled = !!addons.questionnaireEnabled
  const isTeamWide = !!target?.isOrg
  const savedCount = Array.isArray(addons.questionnaire?.questions) ? addons.questionnaire.questions.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6" style={{ color: '#a855f7' }} />
          Custom questionnaire
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Add up to 5 of your own questions to the form on your card.{isTeamWide ? ' This form shows on every card in your team.' : ''}
        </p>
      </div>

      {enabled ? (
        <QuestionnaireBuilder initial={addons.questionnaire || null} />
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
