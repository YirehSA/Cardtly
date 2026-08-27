import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { newTeamCardSlug, orgIndustry } from '@/lib/card-slug-server'
import { checkRows, type ImportRow } from '@/lib/csv-import'
import { newInviteToken, claimUrlFor, sendInviteEmail } from '@/lib/team-invite'

// POST /api/team/bulk-import
// Body: { org_id, rows: ImportRow[], send_invites: boolean, copy_from_id?: string }
//
// Creates team cards from a spreadsheet, one batch at a time, and optionally
// invites each person.
//
// Batched rather than "send the whole file": 500 rows means 500 slug lookups,
// 500 inserts and 500 emails, which no serverless request finishes. The client
// sends BATCH_LIMIT at a time and shows progress, so a large import is a
// sequence of short requests that can be watched and stopped.
//
// The row checks in lib/csv-import run again here. The browser already ran
// them to draw the preview, but a client-side seat check is a suggestion, not
// a limit - and the seat count is what a customer is billed on.

export const maxDuration = 60

/** Rows accepted per request. Sized so the emails finish inside maxDuration. */
const BATCH_LIMIT = 25

type RowResult = {
  line: number
  email: string
  name: string
  outcome: 'created' | 'created_no_email' | 'skipped' | 'failed'
  reason?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: { org_id?: string; rows?: ImportRow[]; send_invites?: boolean; copy_from_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { org_id, rows, send_invites = false, copy_from_id } = body
  if (!org_id || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Missing org_id or rows' }, { status: 400 })
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }
  if (rows.length > BATCH_LIMIT) {
    return NextResponse.json(
      { error: `Send at most ${BATCH_LIMIT} rows per request.` },
      { status: 413 },
    )
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  // Caller must administer this organisation.
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, max_seats')
    .eq('id', org_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  // Seats and existing people, read fresh for every batch. Batch 4 must see
  // the cards batch 3 created, or an import larger than one batch would sail
  // straight past the seat limit.
  const { data: existing } = await admin
    .from('team_cards')
    .select('email, invite_email')
    .eq('organization_id', org_id)

  const used = (existing || []).length
  const seatsAvailable = Math.max(0, (org.max_seats || 0) - used)
  const existingEmails = (existing || [])
    .flatMap((c: any) => [c.email, c.invite_email])
    .filter(Boolean) as string[]

  const checked = checkRows(rows, existingEmails, seatsAvailable)

  const inviterName = await inviterNameFor(admin, user)
  const industry = await orgIndustry(admin, org_id)
  const brand = copy_from_id ? await brandFrom(admin, copy_from_id, org_id) : null

  const results: RowResult[] = []
  let created = 0

  for (const row of checked) {
    if (row.status !== 'ready') {
      results.push({ line: row.line, email: row.email, name: row.name, outcome: 'skipped', reason: row.status })
      continue
    }

    try {
      const slug = await newTeamCardSlug(admin, org_id, row.name || 'team')
      const fields: Record<string, any> = {
        organization_id: org_id,
        name: row.name,
        title: row.title || null,
        email: row.email || null,
        phone: row.phone || null,
        company: row.company || null,
        slug,
        ...(industry ? { industry } : {}),
        ...(brand || {}),
      }

      // Invited in the same insert as the card, so a card never exists in a
      // state where nobody knows who it was meant for.
      const token = send_invites ? newInviteToken() : null
      if (token) {
        fields.invite_email = row.email
        fields.invite_token = token
        fields.invite_sent_at = new Date().toISOString()
      }

      const { data: card, error } = await admin.from('team_cards').insert(fields).select('id').single()
      if (error || !card) {
        results.push({ line: row.line, email: row.email, name: row.name, outcome: 'failed', reason: error?.message || 'Could not create the card' })
        continue
      }
      created++

      if (!token) {
        results.push({ line: row.line, email: row.email, name: row.name, outcome: 'created' })
        continue
      }

      const { sent, error: mailErr } = await sendInviteEmail({
        to: row.email,
        orgName: org.name,
        inviterName,
        cardName: row.name || 'your team card',
        claimUrl: claimUrlFor(token),
      })

      // A failed email is not a failed import. The card is real and the admin
      // can resend from the team screen, so reporting this as a failure would
      // invite them to import the person a second time and duplicate the card.
      results.push({
        line: row.line,
        email: row.email,
        name: row.name,
        outcome: sent ? 'created' : 'created_no_email',
        reason: sent ? undefined : mailErr,
      })
    } catch (e: any) {
      results.push({ line: row.line, email: row.email, name: row.name, outcome: 'failed', reason: e?.message || 'Unexpected error' })
    }
  }

  return NextResponse.json({
    created,
    seats_remaining: Math.max(0, seatsAvailable - created),
    results,
  })
}

async function inviterNameFor(admin: any, user: { id: string; email?: string | null }): Promise<string> {
  const { data } = await admin.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
  return data?.name || user.email || 'A team admin'
}

/**
 * Branding copied off an existing card, so an imported cohort looks like the
 * team they are joining rather than 200 blank cards. Same field list the
 * single add-card flow copies.
 */
async function brandFrom(admin: any, cardId: string, orgId: string): Promise<Record<string, any> | null> {
  const { data: source } = await admin
    .from('team_cards')
    .select('*')
    .eq('id', cardId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!source) return null

  return {
    color_theme: source.color_theme,
    company_logo_url: source.company_logo_url,
    website: source.website,
    address: source.address,
    linkedin_url: source.linkedin_url,
    twitter_url: source.twitter_url,
    instagram_url: source.instagram_url,
    facebook_url: source.facebook_url,
    certifications: source.certifications,
    link_1_title: source.link_1_title, link_1_url: source.link_1_url,
    link_2_title: source.link_2_title, link_2_url: source.link_2_url,
    link_3_title: source.link_3_title, link_3_url: source.link_3_url,
    link_4_title: source.link_4_title, link_4_url: source.link_4_url,
    link_5_title: source.link_5_title, link_5_url: source.link_5_url,
  }
}
