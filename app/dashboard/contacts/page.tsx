import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import ProGate from '@/components/card/ProGate'
import EmptyState from '@/components/EmptyState'
import ContactCard from '@/components/dashboard/ContactCard'
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
    .select('id, name, email, phone, message, created_at, source, title, company, website, address, answers')
    .eq(isTeam ? 'team_card_id' : 'card_id', card.id)
    .order('created_at', { ascending: false })

  const rows = contacts || []

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            People who shared their info via your card
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-xl">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{rows.length} contact{rows.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="When someone taps Save Contact or fills in the lead form on your card, they show up here. Share your card to start collecting them."
          action={{ label: 'View my card', href: '/dashboard/card' }}
          accent="#f59e0b"
        />
      ) : (
        /* Contact cards — each manages its own view / edit / delete */
        <div className="space-y-3">
          {rows.map((contact: any) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  )
}
