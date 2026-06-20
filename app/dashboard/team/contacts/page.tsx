import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ContactCard from '@/components/dashboard/ContactCard'

export const metadata = { title: 'Team Contacts' }

export default async function TeamContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get org
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('admin_user_id', user.id)
    .single()

  if (!org) redirect('/dashboard/team')

  // Get all team cards for this org
  const { data: teamCards } = await admin
    .from('team_cards')
    .select('id, name, title')
    .eq('organization_id', org.id)

  const teamCardIds = teamCards?.map(c => c.id) || []

  // Get all contacts for all team cards
  const { data: contacts } = teamCardIds.length > 0
    ? await admin
        .from('contacts')
        .select('id, name, email, phone, message, created_at, team_card_id, source, title, company, website, address')
        .in('team_card_id', teamCardIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const rows = contacts || []

  // Build a lookup map for team card names
  const cardMap = Object.fromEntries((teamCards || []).map(c => [c.id, c]))

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/team"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="w-4 h-4" />{org.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <div>
            <h1 className="font-display text-2xl font-bold">Team Contacts</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              People who shared their info via your team cards
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-xl">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {rows.length} contact{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="font-semibold text-lg mb-2">No contacts yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            When someone fills in the contact form on any team card, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((contact: any) => {
            const teamCard = contact.team_card_id ? cardMap[contact.team_card_id] : null
            const via = teamCard ? `${teamCard.name}${teamCard.title ? ` · ${teamCard.title}` : ''}` : null
            return <ContactCard key={contact.id} contact={contact} viaLabel={via} />
          })}
        </div>
      )}
    </div>
  )
}
