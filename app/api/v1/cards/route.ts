import { NextResponse } from 'next/server'
import { serve, apiError } from '@/lib/api-auth'

// GET /api/v1/cards
//
// Every card in the organisation, with the department it sits in and the
// company above that. Enough to keep a staff directory in another system in
// step with this one.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return serve(request, 'cards:read', async (admin, ctx) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

    const [{ data: cards, error }, { data: depts }] = await Promise.all([
      admin.from('team_cards').select('*').eq('organization_id', ctx.orgId).order('created_at', { ascending: true }),
      // select('*') rather than naming parent_id and kind: those arrive with a
      // hand-applied migration, and naming a column that is not there yet
      // returns an EMPTY result, which would drop the company off every card
      // rather than failing loudly.
      admin.from('departments').select('*').eq('organization_id', ctx.orgId),
    ])
    if (error) return apiError(500, 'Could not read cards.')

    const byId = new Map((depts || []).map((d: any) => [d.id, d]))
    // Nearest ancestor that is a company. Cycle-safe, like every other walk.
    const companyOf = (deptId: string | null) => {
      let current = deptId
      const seen = new Set<string>()
      let company: any = null
      while (current && !seen.has(current)) {
        seen.add(current)
        const node: any = byId.get(current)
        if (!node) break
        if (node.kind === 'company') company = node
        current = node.parent_id ?? null
      }
      return company
    }

    return NextResponse.json({
      cards: (cards || []).map((c: any) => {
        const dept: any = c.department_id ? byId.get(c.department_id) : null
        const company = companyOf(c.department_id ?? null)
        return {
          id: c.id,
          name: c.name ?? null,
          title: c.title ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          work_phone: c.work_phone ?? null,
          slug: c.slug ?? null,
          url: c.slug ? `${appUrl}/card/${c.slug}` : null,
          // Live only once the person has claimed it. A card that was issued
          // and never picked up is the state a directory sync needs to know
          // about, not one to publish as if it were in use.
          claimed: !!c.claimed_at,
          invited_email: c.invite_email ?? null,
          views: c.view_count || 0,
          department: dept ? { id: dept.id, name: dept.name } : null,
          company: company ? { id: company.id, name: company.name, url_segment: company.slug_segment ?? null } : null,
          created_at: c.created_at,
        }
      }),
    })
  })
}
