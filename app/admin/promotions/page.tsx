import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import PromotionsAdmin from '@/components/admin/PromotionsAdmin'
import { isAdminUser } from '@/lib/admin-check'

export const metadata = { title: 'Promotions Admin' }

export default async function PromotionsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!await isAdminUser(user?.id)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Fetch everything in parallel
  const [
    { data: counter },
    { data: founders },
    { data: referrals },
    { data: entries },
    { data: winners },
    { data: subscriptions },
    authResp,
  ] = await Promise.all([
    admin.from('founder_count').select('*').maybeSingle(),
    admin
      .from('profiles')
      .select('user_id, founder_number, founder_lifetime_pro, referral_code')
      .eq('is_founder', true)
      .order('founder_number', { ascending: true }),
    admin
      .from('referrals')
      .select('id, referrer_user_id, referred_user_id, status, created_at, became_paid_at, became_active_at')
      .order('created_at', { ascending: false }),
    admin
      .from('promo_entries')
      .select('id, user_id, source, idempotency_key, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('promo_winners')
      .select('id, tier, prize, user_id, drawn_at, drawn_by')
      .order('drawn_at', { ascending: false }),
    admin.from('whop_subscriptions').select('user_id, plan_id, status, subscription_tier, billing_cycle, created_at, metadata'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const authUsers = authResp?.data?.users || []
  const emailByUser: Record<string, string> = {}
  for (const u of authUsers) {
    if (u.id && u.email) emailByUser[u.id] = u.email
  }

  // Map active subs by user_id (most recent active first)
  const subByUser: Record<string, any> = {}
  for (const s of (subscriptions || []) as any[]) {
    if (!subByUser[s.user_id] || s.status === 'active') {
      subByUser[s.user_id] = s
    }
  }

  // Founders with subscription + email
  const founderRows = (founders || []).map((f: any) => ({
    user_id: f.user_id,
    email: emailByUser[f.user_id] || '(unknown)',
    founder_number: f.founder_number,
    lifetime_pro: !!f.founder_lifetime_pro,
    referral_code: f.referral_code,
    plan_id: subByUser[f.user_id]?.plan_id || null,
    sub_status: subByUser[f.user_id]?.status || null,
    period_end: subByUser[f.user_id]?.metadata?.period_end || null,
  }))

  // Referrals with both emails
  const referralRows = (referrals || []).map((r: any) => ({
    id: r.id,
    referrer_email: emailByUser[r.referrer_user_id] || '(unknown)',
    referred_email: emailByUser[r.referred_user_id] || '(unknown)',
    status: r.status,
    created_at: r.created_at,
    became_paid_at: r.became_paid_at,
    became_active_at: r.became_active_at,
  }))

  // Entries: count by source, plus per-user totals (top 50)
  const entriesBySource: Record<string, number> = {}
  const entriesByUser: Record<string, number> = {}
  for (const e of (entries || []) as any[]) {
    entriesBySource[e.source] = (entriesBySource[e.source] || 0) + 1
    entriesByUser[e.user_id] = (entriesByUser[e.user_id] || 0) + 1
  }
  const topUsers = Object.entries(entriesByUser)
    .map(([user_id, count]) => ({
      user_id,
      email: emailByUser[user_id] || '(unknown)',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  // Winners with email
  const winnerRows = (winners || []).map((w: any) => ({
    id: w.id,
    tier: w.tier,
    prize: w.prize,
    user_id: w.user_id,
    email: emailByUser[w.user_id] || '(unknown)',
    drawn_at: w.drawn_at,
    drawn_by: w.drawn_by,
  }))

  // Tier progress: count of active Pro subs
  const activePaidCount = (subscriptions || []).filter((s: any) =>
    s.status === 'active' && s.subscription_tier === 'pro'
  ).length

  // Referral stats
  const refStats = {
    total: referralRows.length,
    pending: referralRows.filter((r: any) => r.status === 'pending').length,
    active: referralRows.filter((r: any) => r.status === 'active').length,
    paid: referralRows.filter((r: any) => r.status === 'paid').length,
    cancelled: referralRows.filter((r: any) => r.status === 'cancelled').length,
  }

  return (
    <PromotionsAdmin
      counter={{
        filled: counter?.filled ?? 0,
        remaining: counter?.remaining ?? 100,
        total: counter?.total ?? 100,
      }}
      founders={founderRows}
      referrals={referralRows}
      refStats={refStats}
      entriesBySource={entriesBySource}
      totalEntries={entries?.length || 0}
      topUsers={topUsers}
      winners={winnerRows}
      activePaidCount={activePaidCount}
      totalUsers={authUsers.length}
    />
  )
}
