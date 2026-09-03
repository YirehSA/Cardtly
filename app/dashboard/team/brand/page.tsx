import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import TeamBrandPanel from '@/components/team/TeamBrandPanel'
import OrgIdentityPanel from '@/components/team/OrgIdentityPanel'

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
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, brand')
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
  const { data: cardRows } = await admin
    .from('team_cards')
    .select('use_team_brand')
    .eq('organization_id', org.id)
  const totalCards = cardRows?.length ?? 0
  const brandedCards = (cardRows || []).filter((c: any) => c.use_team_brand).length

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in pb-16">
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold leading-tight">How your team&apos;s cards look</h1>
              <p className="text-muted-foreground text-sm">
                Set your logo and colours once, and every card in the team wears them.
              </p>
            </div>
          </div>
        </div>
      </div>

      <OrgIdentityPanel orgId={org.id} orgName={org.name}
        slugPrefix={identity.card_slug_prefix} industry={identity.industry}
        cardCount={totalCards} />

      <TeamBrandPanel orgId={org.id} brand={brand} hasBrand={hasBrand}
        totalCards={totalCards} brandedCards={brandedCards} />
    </div>
  )
}
