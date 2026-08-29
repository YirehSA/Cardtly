import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import { getManagedDepartments } from '@/lib/department-perms'
import { withResolvedBrand } from '@/lib/resolve-card-brand'
import { redirect } from 'next/navigation'
import QRPage from '@/components/card/QRPage'

interface CardSummary {
  title?: string | null
  id: string
  slug: string | null
  name: string | null
  profile_image_url: string | null
  company_logo_url: string | null
  color_theme: string | null
}

export const metadata = { title: 'QR Code' }

export default async function QRCodePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [personalCard, plan] = await Promise.all([
    getPrimaryCard<CardSummary>(user.id, 'id, slug, name, title, profile_image_url, company_logo_url, color_theme'),
    getUserPlan(user.id),
  ])

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Which team cards this person may make a QR code for.
  //
  // This asked only whether they own the organisation, so a department head
  // got an empty list and could not produce a QR code for anybody on their
  // own team - including, if they had no personal card, for themselves. Heads
  // are exactly the people printing signage and email footers for their team,
  // so it was missing for the ones who needed it most.
  //
  // An owner still gets the whole company. A head gets the departments
  // getManagedDepartments returns, which is already their own subtree and
  // never a sibling's.
  const [{ data: org }, managed, memberCard] = await Promise.all([
    admin.from('organizations').select('id').eq('admin_user_id', user.id).maybeSingle(),
    getManagedDepartments(admin, user.id),
    getMemberTeamCard<CardSummary>(user.id, '*'),
  ])

  // select('*') so use_team_brand, department_id and organization_id come
  // along. They are needed to resolve what the card actually looks like, and
  // naming a column that a pending migration has not added yet returns an
  // empty result rather than an error.
  let teamCards: any[] = []
  if (org) {
    const { data } = await admin
      .from('team_cards').select('*')
      .eq('organization_id', org.id).eq('is_active', true).order('name')
    teamCards = data || []
  } else if (managed.length > 0) {
    const { data } = await admin
      .from('team_cards').select('*')
      .in('department_id', managed.map(d => d.id)).eq('is_active', true).order('name')
    teamCards = data || []
  }

  // A member with no personal card still needs their own QR. Skipped when the
  // list above already contains it, or it would appear twice.
  const own = memberCard && !teamCards.some(c => c.id === (memberCard as any).id)
    ? [memberCard as any] : []

  // A card on the team brand carries no logo of its own, so reading the row
  // told a member to upload one while their card already showed the company
  // logo everywhere else. See lib/resolve-card-brand.
  const branded = await withResolvedBrand(admin, [...teamCards, ...own])
  teamCards = branded.slice(0, teamCards.length)
  for (let i = 0; i < own.length; i++) own[i] = branded[teamCards.length + i]


  const allCards = [
    ...(personalCard ? [{ ...personalCard, _label: `${personalCard.name} (My card)` }] : []),
    ...own.map((c: any) => ({ ...c, _label: `${c.name} (My team card)` })),
    ...teamCards.map((c: any) => ({ ...c, _label: `${c.name} — Team` })),
  ]

  if (allCards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found. Create your card first.</p>
      </div>
    )
  }

  return (
    <QRPage
      cards={allCards as any}
      defaultCardId={(personalCard?.id as string) || (allCards[0] as any).id}
      plan={plan}
    />
  )
}
