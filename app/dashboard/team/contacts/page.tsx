import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Users, ArrowLeft } from 'lucide-react'
import PageHeader from '@/components/dashboard/PageHeader'
import Link from 'next/link'
import ContactsList from '@/components/dashboard/ContactsList'
import ExportContactsButton from '@/components/dashboard/ExportContactsButton'

export const metadata = { title: 'Team Contacts' }

export default async function TeamContactsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Not .single(). Team setup creates the org row before payment, so an
  // abandoned checkout can leave more than one row against an admin - and
  // .single() then returns nothing, which bounced the admin back to the team
  // page instead of showing their contacts. Prefer the live org.
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('admin_user_id', user.id)
    .order('business_plan_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!org) redirect('/dashboard/team')

  const { data: teamCards } = await admin
    .from('team_cards')
    .select('id, name, title')
    .eq('organization_id', org.id)

  const teamCardIds = teamCards?.map(c => c.id) || []

  const { data: contacts } = teamCardIds.length > 0
    ? await admin
        .from('contacts')
        .select('id, name, email, phone, message, created_at, team_card_id, source, title, company, website, address, answers')
        .in('team_card_id', teamCardIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const rows = contacts || []
  const cardMap = Object.fromEntries((teamCards || []).map(c => [c.id, c]))

  // Tag every lead with the member whose card captured it. The list uses this
  // for the per-member filter and the badge; the export uses it for the
  // "Team Member" column.
  const tagged = rows.map((r: any) => {
    const card = r.team_card_id ? cardMap[r.team_card_id] : null
    return {
      ...r,
      _via: card ? `${card.name}${card.title ? ` · ${card.title}` : ''}` : null,
      owner: card?.name ?? null,
    }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-5 stagger pb-16">
      <PageHeader
        back={{ href: '/dashboard/team', label: org.name }}
        eyebrow="Team leads"
        title={<>Everyone your team has met</>}
        subtitle="Every lead from every team card in one place. Filter by the person who captured it."
      />

      <ContactsList
        rows={tagged as any}
        emptyTitle="Your team has not captured anyone yet"
        emptyDescription="When someone fills in the form on any team card, books a meeting or answers a questionnaire, they land here alongside the team member who met them."
        headerAction={
          <ExportContactsButton
            contacts={tagged as any}
            filename="cardtly-team-contacts"
            orgName={org.name}
            ownerLabel="Team Member"
          />
        }
      />
    </div>
  )
}
