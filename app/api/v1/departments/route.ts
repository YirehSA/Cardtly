import { NextResponse } from 'next/server'
import { serve, apiError } from '@/lib/api-auth'

// GET /api/v1/departments
//
// The organisation's structure: companies, the departments inside them, and
// how they nest. Returned flat with parent_id rather than as a nested tree,
// because a caller mapping this into their own system usually wants rows, and
// nesting is one line of code away from rows while the reverse is not.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return serve(request, 'departments:read', async (admin, ctx) => {
    const { data, error } = await admin
      .from('departments').select('*').eq('organization_id', ctx.orgId).order('name', { ascending: true })
    if (error) return apiError(500, 'Could not read the structure.')

    return NextResponse.json({
      departments: (data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        // 'company' or 'department'. Absent before the hierarchy migration, in
        // which case everything is a flat department, which is the truth.
        kind: d.kind === 'company' ? 'company' : 'department',
        parent_id: d.parent_id ?? null,
        url_segment: d.slug_segment ?? null,
        created_at: d.created_at,
      })),
    })
  })
}
