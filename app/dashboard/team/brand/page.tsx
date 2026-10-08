import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import PageHeader from '@/components/dashboard/PageHeader'
import TeamBrandPanel from '@/components/team/TeamBrandPanel'
import OrgIdentityPanel from '@/components/team/OrgIdentityPanel'
import { parseBrandSource } from '@/lib/brand-source'
import { LOCK_GROUPS } from '@/lib/team-locks'

export const metadata = { title: 'Team Brand' }

export default async function TeamBrandPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Prefer the live org. An abandoned team checkout can leave a second row
  // against the same admin, and maybeSingle throws on more than one match.
  // select('*'), server-side only: brand_source and locked_fields come with it
  // without naming columns a hand-applied migration may not have added. Only
  // the fields below are handed to the browser.
  const { data: org } = await admin
    .from('organizations')
    .select('*')
    .eq('admin_user_id', user.id)
    .order('business_plan_active', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!org) redirect('/dashboard/team')

  const brand = org.brand || {}
  const hasBrand = Object.keys(brand).length > 0

  // Both columns arrive with migration 044. Asked for separately and
  // tolerantly so this page still renders before it is run - the panel just
  // falls back to suggesting a prefix from the company name.
  const identity = await (async (): Promise<{ card_slug_prefix: string | null; industry: string | null }> => {
    try {
      const { data, error } = await admin
        .from('organizations').select('card_slug_prefix, industry').eq('id', org.id).maybeSingle()
      if (error) return { card_slug_prefix: null, industry: null }
      return {
        card_slug_prefix: (data as any)?.card_slug_prefix || null,
        industry: (data as any)?.industry || null,
      }
    } catch {
      return { card_slug_prefix: null, industry: null }
    }
  })()

  // How many cards are actually wearing the brand. The panel used to claim
  // "Live on all team cards" purely because a brand object existed, but the
  // per-card toggle is off by default - so that badge could sit above a brand
  // no card in the company was using.
  //
  // The card the look follows is left out of both counts: it IS the look and
  // never wears it (lib/brand-source, isLookSource), so counting it made "all
  // cards" unreachable once the owner's card was in the team.
  const source = parseBrandSource((org as any).brand_source)
  const { data: cardRows } = await admin
    .from('team_cards')
    .select('id, use_team_brand')
    .eq('organization_id', org.id)
  const wearers = (cardRows || []).filter((c: any) => !(source?.table === 'team_cards' && c.id === source.id))
  const totalCards = wearers.length
  const brandedCards = wearers.filter((c: any) => c.use_team_brand).length

  // Whose card the look follows, by name, so the page can say so.
  const { data: sourceCard } = source
    ? await admin.from(source.table).select('name').eq('id', source.id).maybeSingle()
    : { data: null }
  const lookSource = source
    ? { name: (sourceCard as any)?.name || null, own: source.table === 'cards' || (cardRows || []).some((c: any) => c.id === source.id) }
    : null

  // The company rules, by label, so the brand page can say what is locked
  // without sending anybody to another screen to find out.
  const lockedLabels = LOCK_GROUPS
    .filter(g => Array.isArray((org as any).locked_fields) && (org as any).locked_fields.includes(g.id))
    .map(g => g.label)

  return (
    <div className="max-w-3xl mx-auto space-y-5 stagger pb-16">
      <PageHeader
        back={{ href: '/dashboard/team', label: org.name }}
        eyebrow="Team brand"
        title={<>How your team&apos;s cards look</>}
        subtitle="Set your logo and colours once, and every card in the team wears them."
      />

      <OrgIdentityPanel orgId={org.id} orgName={org.name}
        slugPrefix={identity.card_slug_prefix} industry={identity.industry}
        cardCount={totalCards} />

      <TeamBrandPanel orgId={org.id} orgName={org.name} brand={brand} hasBrand={hasBrand}
        totalCards={totalCards} brandedCards={brandedCards}
        lookSource={lookSource} lockedLabels={lockedLabels} />
    </div>
  )
}
