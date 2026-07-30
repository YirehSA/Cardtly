import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import ProGate from '@/components/card/ProGate'
import ContactsList from '@/components/dashboard/ContactsList'
import { Users } from 'lucide-react'

interface CardSummary {
  id: string
  name: string | null
  slug: string | null
}

export const metadata = { title: 'Contacts' }

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [personalCard, plan] = await Promise.all([
    getPrimaryCard<CardSummary>(user.id, 'id, name, slug'),
    getUserPlan(user.id),
  ])

  // Team members have no personal card - fall back to their claimed
  // team card so they can see their own leads (the team admin sees
  // these too in Team Contacts).
  const teamCard = personalCard ? null : await getMemberTeamCard<CardSummary>(user.id, 'id, name, slug')
  const card = personalCard || teamCard
  const isTeam = !personalCard && !!teamCard

  // Pro gate applies to personal cards. Team cards are always Pro
  // (the org pays), so team members skip the gate.
  const isPro = (plan.tier === 'pro' && plan.isActive) || isTeam

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Contacts" />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found.</p>
      </div>
    )
  }

  // Team-card contacts are blocked from anon RLS reads, so use the
  // service-role client for those; personal cards use the user client.
  const reader = isTeam
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
    : supabase
  const { data: contacts } = await reader
    .from('contacts')
    // select('*') rather than a column list. work_phone arrives with migration
    // 045, applied by hand after the deploy, and an explicit list naming a
    // column that does not exist yet returns 42703 - which would take down the
    // entire contacts page, not just one field. Same reasoning as the ops
    // digest. These rows are the user's own leads and every column is already
    // shown to them.
    .select('*')
    .eq(isTeam ? 'team_card_id' : 'card_id', card.id)
    .order('created_at', { ascending: false })

  const rows = contacts || []

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <div className="rounded-3xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.14), transparent 65%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">People who reached out</h1>
              <p className="text-muted-foreground text-sm">
                Everyone who left their details on {isTeam ? 'your team card' : 'your card'}. Tap any of them to reply.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search, filter, stats and the list itself */}
      <ContactsList rows={rows as any} ownerName={card.name || undefined} />
    </div>
  )
}
