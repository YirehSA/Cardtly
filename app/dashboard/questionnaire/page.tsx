import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import QuestionnaireBuilder from '@/components/questionnaire/QuestionnaireBuilder'
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

  // Resolve the card + its addons (personal first, else team card).
  let { data: card } = await admin.from('cards').select('addons').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!card) {
    const r = await admin.from('team_cards').select('addons').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    card = r.data
  }

  const addons = card?.addons || {}
  const enabled = !!addons.questionnaireEnabled

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6" style={{ color: '#a855f7' }} />
          Custom questionnaire
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Add up to 5 of your own questions to the form on your card.
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
