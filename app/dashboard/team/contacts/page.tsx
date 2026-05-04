import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Users, Mail, Phone, MessageSquare, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
        .select('id, name, email, phone, message, created_at, team_card_id')
        .in('team_card_id', teamCardIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const rows = contacts || []

  // Build a lookup map for team card names
  const cardMap = Object.fromEntries((teamCards || []).map(c => [c.id, c]))

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

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
          {rows.map(contact => {
            const teamCard = contact.team_card_id ? cardMap[contact.team_card_id] : null
            return (
              <div key={contact.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                      {contact.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{contact.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(contact.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {/* Which team card they contacted */}
                    {teamCard && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                        via {teamCard.name}{teamCard.title ? ` · ${teamCard.title}` : ''}
                      </span>
                    )}

                    {contact.email && (
                      <a href={`mailto:${contact.email}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        {contact.phone}
                      </a>
                    )}
                  </div>
                </div>

                {contact.message && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">{contact.message}</p>
                    </div>
                  </div>
                )}

                {contact.email && (
                  <div className="mt-4">
                    <a href={`mailto:${contact.email}?subject=Re: We connected on Cardtly`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">
                      <Mail className="w-3 h-3" />Reply
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
