import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import { getManagedDepartments } from '@/lib/department-perms'
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

  const admin0 = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Every card whose leads this person is entitled to see.
  //
  // This used to be exactly one card, and the team card was only consulted
  // when there was no personal one. So somebody holding both - which is every
  // department head who also signed up in the usual way - saw their personal
  // leads and none of the ones their team card had captured, with nothing on
  // screen saying a second card existed. A head could not see their team's
  // leads at all.
  const [teamCard, managed] = await Promise.all([
    getMemberTeamCard<CardSummary>(user.id, 'id, name, slug'),
    getManagedDepartments(admin0, user.id),
  ])

  // A head sees their whole subtree; getManagedDepartments has already
  // limited that to their own departments and never a sibling's.
  const { data: managedCards } = managed.length > 0
    ? await admin0.from('team_cards').select('id, name, slug')
        .in('department_id', managed.map(d => d.id)).eq('is_active', true)
    : { data: [] }

  const teamSources = new Map<string, { id: string; name: string | null }>()
  if (teamCard) teamSources.set((teamCard as any).id, teamCard as any)
  for (const c of managedCards || []) teamSources.set(c.id, c)

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

  // Read with the service-role client throughout. Team-card contacts are
  // blocked from anon RLS reads, and every id below has already been
  // established as this user's own or inside a department they manage, so the
  // scoping is done here rather than left to a policy that cannot see it.
  //
  // select('*') rather than a column list. work_phone arrives with migration
  // 045, applied by hand after the deploy, and naming a column that does not
  // exist yet returns 42703 - which would take down the whole contacts page
  // rather than one field.
  const personalIds = personalCard ? [(personalCard as any).id] : []
  const teamIds = [...teamSources.keys()]

  const [personalLeads, teamLeads] = await Promise.all([
    personalIds.length
      ? admin0.from('contacts').select('*').in('card_id', personalIds)
      : Promise.resolve({ data: [] }),
    teamIds.length
      ? admin0.from('contacts').select('*').in('team_card_id', teamIds)
      : Promise.resolve({ data: [] }),
  ])

  // _via names the card that captured each lead. ContactsList turns that into
  // a per-card filter, which is what makes one combined list usable rather
  // than confusing: a head can pull up just their own, or just one person's.
  // Only set when there is genuinely more than one card in play, or every row
  // would carry a label that distinguishes nothing.
  const multiple = personalIds.length + teamIds.length > 1
  const rows = [
    ...(personalLeads.data || []).map((r: any) => ({
      ...r, _via: multiple ? ((personalCard as any)?.name || 'My card') : undefined,
    })),
    ...(teamLeads.data || []).map((r: any) => ({
      ...r, _via: multiple ? (teamSources.get(r.team_card_id)?.name || 'Team card') : undefined,
    })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

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
                {managed.length > 0
                  ? <>Everyone who left their details on your card or on a card in {managed.length === 1 ? managed[0].name : 'your departments'}. Tap any of them to reply.</>
                  : multiple
                    ? <>Everyone who left their details on any of your cards. Tap any of them to reply.</>
                    : <>Everyone who left their details on {isTeam ? 'your team card' : 'your card'}. Tap any of them to reply.</>}
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
