import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Users, ArrowLeft } from 'lucide-react'
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
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: 'hsl(var(--card))' }}>
          <Link href="/dashboard/team"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-3">
            <ArrowLeft className="w-3.5 h-3.5" />{org.name}
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg grid place-items-center text-white shrink-0"
              style={{ background: 'hsl(var(--accent))' }}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">Everyone your team has met</h1>
              <p className="text-muted-foreground text-sm">
                Every lead from every team card in one place. Filter by the person who captured it.
              </p>
            </div>
          </div>
        </div>
      </div>

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
