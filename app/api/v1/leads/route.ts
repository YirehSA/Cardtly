import { NextResponse } from 'next/server'
import { serve, apiError } from '@/lib/api-auth'
import { clampLimit } from '@/lib/api-keys'

// GET /api/v1/leads
//
// Every lead captured by any card in the organisation, oldest first.
//
// Paged by time, not offset. Offset paging over a table still being written to
// silently skips rows: a lead captured between page one and page two shifts
// everything down by one, and the row that crosses the boundary is never
// returned. A sync that loses a lead and reports success is worse than one
// that fails, so callers pass the last created_at they saw.
//
//   ?since=2026-08-27T10:00:00Z   exclusive, ISO 8601
//   ?limit=100                    max 500
//
// The response carries next_since, which is simply the last row's captured_at.
// When fewer than `limit` rows come back, you are up to date.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return serve(request, 'leads:read', async (admin, ctx) => {
    const params = new URL(request.url).searchParams
    const limit = clampLimit(params.get('limit'))
    const since = params.get('since')

    if (since && Number.isNaN(new Date(since).getTime())) {
      return apiError(400, 'since must be an ISO 8601 timestamp, for example 2026-08-27T10:00:00Z')
    }

    // Leads belong to cards, and cards belong to the org. Resolved rather than
    // trusted from a parameter, so a key can only ever reach its own leads.
    const { data: cards } = await admin
      .from('team_cards')
      .select('id, name, slug, department_id')
      .eq('organization_id', ctx.orgId)

    const cardIds = (cards || []).map((c: any) => c.id)
    if (cardIds.length === 0) {
      return NextResponse.json({ leads: [], next_since: since || null, has_more: false })
    }
    const byId = new Map((cards || []).map((c: any) => [c.id, c]))

    let q = admin
      .from('contacts')
      .select('*')
      .in('team_card_id', cardIds)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (since) q = q.gt('created_at', since)

    const { data, error } = await q
    if (error) return apiError(500, 'Could not read leads.')

    const rows = data || []
    const leads = rows.map((r: any) => {
      const card = byId.get(r.team_card_id) as any
      return {
        id: r.id,
        name: r.name ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        work_phone: r.work_phone ?? null,
        company: r.company ?? null,
        title: r.title ?? null,
        website: r.website ?? null,
        address: r.address ?? null,
        message: r.message ?? null,
        source: r.source ?? null,
        answers: r.answers ?? null,
        captured_at: r.created_at,
        card: card ? { id: card.id, name: card.name, slug: card.slug } : null,
      }
    })

    return NextResponse.json({
      leads,
      // Feed this straight back as ?since on the next call.
      next_since: rows.length ? rows[rows.length - 1].created_at : (since || null),
      has_more: rows.length === limit,
    })
  })
}
