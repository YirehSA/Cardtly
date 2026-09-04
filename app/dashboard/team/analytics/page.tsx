import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Eye, Users, TrendingUp, ExternalLink, MousePointerClick, AlertCircle,
} from 'lucide-react'
import { LABEL } from '@/components/dashboard/ui'

export const metadata = { title: 'Team Analytics' }

export default async function TeamAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Prefer the live org. An abandoned team checkout can leave a second row
  // against the same admin, and .single() returns nothing when it does.
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
    .select('id, name, title, slug, view_count')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('view_count', { ascending: false, nullsFirst: false })

  const cards = teamCards || []
  const ids = cards.map((c: any) => c.id)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // All event types, not just views. Taps and contact saves are now actually
  // recorded, and they say something views cannot: whether the people opening
  // a card do anything once they are there.
  const [{ data: events }, { data: contacts }] = ids.length > 0
    ? await Promise.all([
        admin.from('team_card_events').select('team_card_id, event_type').gte('created_at', thirtyDaysAgo).in('team_card_id', ids),
        admin.from('contacts').select('team_card_id').in('team_card_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const bucket = (type: string) => {
    const out: Record<string, number> = {}
    for (const e of (events as any[]) || []) {
      if (e.event_type === type && e.team_card_id) out[e.team_card_id] = (out[e.team_card_id] || 0) + 1
    }
    return out
  }
  const views30 = bucket('view')
  const taps30 = bucket('link_click')

  const leadsByCard: Record<string, number> = {}
  for (const c of (contacts as any[]) || []) if (c.team_card_id) leadsByCard[c.team_card_id] = (leadsByCard[c.team_card_id] || 0) + 1

  const rows = cards
    .map((c: any) => ({
      ...c,
      views30: views30[c.id] || 0,
      taps30: taps30[c.id] || 0,
      allTime: c.view_count || 0,
      leads: leadsByCard[c.id] || 0,
    }))
    .sort((a: any, b: any) => (b.views30 - a.views30) || (b.allTime - a.allTime))

  const sum = (k: string) => rows.reduce((s: number, r: any) => s + r[k], 0)
  const quiet = rows.filter((r: any) => r.allTime === 0).length

  const stats = [
    { label: 'Opens, last 30 days', value: sum('views30'), icon: TrendingUp },
    { label: 'Opens, all time', value: sum('allTime'), icon: Eye },
    { label: 'Buttons tapped, 30 days', value: sum('taps30'), icon: MousePointerClick },
    { label: 'Details left', value: sum('leads'), icon: Users },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Header */}
      <header className="pb-5 border-b border-border">
        <Link href="/dashboard/team"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-3.5 h-3.5" />{org.name}
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-2">How your team is doing</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Who is getting their card in front of people, and who needs a nudge.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="panel p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className={LABEL}>{label}</p>
            </div>
            <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums mt-2.5 leading-none">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* A card nobody has opened is a seat being paid for and not used. */}
      {quiet > 0 && rows.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-medium">{quiet} {quiet === 1 ? 'card has' : 'cards have'} never been opened.</span>{' '}
            <span className="text-muted-foreground">
              You are paying for those seats. Check they have been invited and know how to share their card.
            </span>
          </p>
        </div>
      )}

      {/* Per member. A list rather than a table, so it reads properly on a
          phone instead of forcing a sideways scroll. */}
      {rows.length === 0 ? (
        <div className="panel p-16 text-center">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No active team cards yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold px-1">Every card, busiest first</p>
          {rows.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.name || 'Unnamed'}</p>
                  {r.title && <p className="text-xs text-muted-foreground truncate">{r.title}</p>}
                </div>
                {r.slug && (
                  <a href={`/card/${r.slug}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />View card
                  </a>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { k: 'Last 30 days', v: r.views30, tone: undefined },
                  { k: 'All time', v: r.allTime, tone: undefined },
                  { k: 'Taps', v: r.taps30, tone: undefined },
                  { k: 'Contacts', v: r.leads, tone: r.leads > 0 ? '#22c55e' : undefined },
                ].map(({ k, v, tone }) => (
                  <div key={k} className="rounded-xl bg-muted/50 p-2.5 text-center">
                    <p className="text-lg font-bold leading-none tabular-nums"
                      style={tone ? { color: tone } : { color: 'hsl(var(--muted-foreground))' }}>
                      {v.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{k}</p>
                  </div>
                ))}
              </div>
              {r.leads > 0 && (
                <Link href="/dashboard/team/contacts"
                  className="inline-block mt-3 text-xs font-semibold text-primary hover:underline">
                  See who they met
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Opens are counted from when team analytics launched. Taps are counted from when tap tracking launched.
        Both 30-day figures are rolling windows.
      </p>
    </div>
  )
}
