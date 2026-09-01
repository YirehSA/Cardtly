import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard, getMemberTeamCard } from '@/lib/card-server'
import EmailSignatureBuilder, { type SignatureCard } from '@/components/email-signature/EmailSignatureBuilder'
import ProGate from '@/components/card/ProGate'
import { getManagedDepartments } from '@/lib/department-perms'
import { withResolvedBrand } from '@/lib/resolve-card-brand'

export const metadata = { title: 'Email Signature' }

export default async function EmailSignaturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const CARD_FIELDS = 'id, name, title, company, email, phone, website, linkedin_url, twitter_url, instagram_url, facebook_url, youtube, tiktok, profile_image_url, company_logo_url, color_theme, slug'

  const [plan, personalCard] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<Record<string, any>>(user.id, CARD_FIELDS),
  ])

  // A team member has no personal card, so this page used to gate them on
  // their own plan and then tell them "No card found" - locking them out of a
  // signature for the card their company is paying for. Their claimed team
  // card counts, and it is served by the organisation, so it is always Pro.
  const memberCard = personalCard
    ? null
    : await getMemberTeamCard<Record<string, any>>(user.id, '*')

  const isPro = (plan.tier === 'pro' && plan.isActive) || !!memberCard

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProGate feature="Email Signature" />
      </div>
    )
  }

  // Fetch team cards if user has an org
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Not .single(): an abandoned team checkout can leave a second org row, and
  // .single() then returns nothing, silently dropping every team card here.
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('admin_user_id', user.id)
    .order('business_plan_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Which team cards this person may build a signature for.
  //
  // This asked only whether they own the organisation, so a department head
  // saw none of their own team - the same omission the QR page had.
  //
  // select('*') rather than a column list: use_team_brand, department_id and
  // organization_id are needed to work out what the card actually looks like,
  // and naming a column a pending migration has not added returns an empty
  // result rather than an error.
  const managed = org ? [] : await getManagedDepartments(admin, user.id)

  let teamCards: Record<string, any>[] = []
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

  // A card on the team brand has no logo, website or socials of its own, so
  // the signature came out with those toggles greyed and the accent colour at
  // its default. See lib/resolve-card-brand.
  const toBrand = [...teamCards, ...(memberCard ? [memberCard] : [])]
  const branded = await withResolvedBrand(admin, toBrand)
  teamCards = branded.slice(0, teamCards.length)
  if (memberCard) Object.assign(memberCard, branded[teamCards.length])


  // Explicitly typed: cards and team_cards come back with different generated
  // row types (team_cards resolves to never for the columns database.ts does
  // not know about), so the merged list needs a shape of its own rather than
  // whichever union TypeScript infers from the two branches.
  const allCards: SignatureCard[] = [
    ...(personalCard ? [{ ...(personalCard as SignatureCard), _type: 'personal', _label: `${personalCard.name} (My card)` }] : []),
    ...(memberCard ? [{ ...(memberCard as SignatureCard), _type: 'team', _label: `${memberCard.name} (My card)` }] : []),
    ...(teamCards || []).map(c => ({ ...(c as unknown as SignatureCard), _type: 'team', _label: `${c.name}${c.title ? ` — ${c.title}` : ''}` })),
  ]

  if (allCards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found.</p>
      </div>
    )
  }

  return <EmailSignatureBuilder cards={allCards} defaultCardId={personalCard?.id || memberCard?.id || allCards[0].id} />
}
