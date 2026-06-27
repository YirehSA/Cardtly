import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, Users, TrendingUp, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Team Analytics' }

export default async function TeamAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Admin only - the org owner.
  const { data: org } = await admin
    .from('organizations').select('id, name').eq('admin_user_id', user.id).maybeSingle()
  if (!org) redirect('/dashboard/team')

  const { data: teamCards } = await admin
    .from('team_cards')
    .select('id, name, title, slug, view_count')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('view_count', { ascending: false, nullsFirst: false })

  const cards = teamCards || []
  const ids = cards.map((c: any) => c.id)

  // 30-day views + total contacts per card.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: events }, { data: contacts }] = ids.length > 0
    ? await Promise.all([
        admin.from('team_card_events').select('team_card_id').eq('event_type', 'view').gte('created_at', thirtyDaysAgo).in('team_card_id', ids),
        admin.from('contacts').select('team_card_id').in('team_card_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const views30: Record<string, number> = {}
  for (const e of (events as any[]) || []) views30[e.team_card_id] = (views30[e.team_card_id] || 0) + 1
  const leadsByCard: Record<string, number> = {}
  for (const c of (contacts as any[]) || []) if (c.team_card_id) leadsByCard[c.team_card_id] = (leadsByCard[c.team_card_id] || 0) + 1

  const rows = cards
    .map((c: any) => ({
      ...c,
      views30: views30[c.id] || 0,
      allTime: c.view_count || 0,
      leads: leadsByCard[c.id] || 0,
    }))
    .sort((a: any, b: any) => (b.views30 - a.views30) || (b.allTime - a.allTime))

  const totalAllTime = rows.reduce((s: number, r: any) => s + r.allTime, 0)
  const total30 = rows.reduce((s: number, r: any) => s + r.views30, 0)
  const totalLeads = rows.reduce((s: number, r: any) => s + r.leads, 0)

  const stats = [
    { label: 'Views, last 30 days', value: total30, icon: TrendingUp, color: '#00d4ff' },
    { label: 'Views, all time', value: totalAllTime, icon: Eye, color: '#a855f7' },
    { label: 'Contacts captured', value: totalLeads, icon: Users, color: '#22c55e' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/team" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" />{org.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <div>
          <h1 className="font-display text-2xl font-bold">Team Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Views and leads for every card in your team</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <Icon className="w-5 h-5 mb-2" style={{ color }} />
            <p className="text-3xl font-black tabular-nums">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-member */}
      {rows.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No active team cards yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                {['Team member', 'Last 30d', 'All-time', 'Contacts', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{r.name || 'Unnamed'}</p>
                    {r.title && <p className="text-xs text-muted-foreground">{r.title}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums"
                      style={r.views30 > 0 ? { background: 'rgba(0,212,255,0.12)', color: '#0891b2' } : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                      {r.views30.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">{r.allTime.toLocaleString()}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {r.leads > 0
                      ? <Link href="/dashboard/team/contacts" className="font-semibold text-primary hover:underline">{r.leads}</Link>
                      : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.slug && (
                      <a href={`/card/${r.slug}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
                        <ExternalLink className="w-3.5 h-3.5" />View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Views are tracked from when team analytics launched. &ldquo;Last 30 days&rdquo; is a rolling window.
      </p>
    </div>
  )
}
