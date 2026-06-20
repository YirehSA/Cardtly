import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import ProGate from '@/components/card/ProGate'
import EmptyState from '@/components/EmptyState'
import AddToPhoneButton from '@/components/dashboard/AddToPhoneButton'
import { Users, Mail, Phone, MessageSquare, Calendar, ScanLine, Globe, MapPin } from 'lucide-react'

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
    .select('id, name, email, phone, message, created_at, source, title, company, website, address')
    .eq(isTeam ? 'team_card_id' : 'card_id', card.id)
    .order('created_at', { ascending: false })

  const rows = contacts || []

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

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
        /* Contact cards */
        <div className="space-y-3">
          {rows.map(contact => (
            <div key={contact.id} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Name + date */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                    {contact.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{contact.name}</p>
                    {(contact.title || contact.company) && (
                      <p className="text-xs text-muted-foreground">
                        {[contact.title, contact.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(contact.created_at)}
                    </p>
                  </div>
                </div>

                {/* Contact details */}
                <div className="flex flex-wrap items-center gap-4">
                  {contact.source === 'booking' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />Meeting request
                    </span>
                  )}
                  {contact.source === 'scanned' && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-400 flex items-center gap-1">
                      <ScanLine className="w-3 h-3" />Scanned
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

              {/* Message */}
              {contact.message && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{contact.message}</p>
                  </div>
                </div>
              )}

              {/* Website / address for scanned cards */}
              {(contact.website || contact.address) && (
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {contact.website && (
                    <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:text-foreground transition">
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />{contact.website}
                    </a>
                  )}
                  {contact.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />{contact.address}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}?subject=Re: We connected on Cardtly`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">
                    <Mail className="w-3 h-3" />
                    Reply
                  </a>
                )}
                <AddToPhoneButton contact={contact} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
