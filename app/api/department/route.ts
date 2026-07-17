import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { BRAND_FIELDS } from '@/lib/team-brand'
import { getManagedDepartments, canManageDepartment, cardDepartment, isOrgOwner, ownsOrgOfDepartment, findUserByEmail, getOwnedOrgs } from '@/lib/department-perms'
import { newInviteToken, sendTeamInvite } from '@/lib/team-invite'

// The department manager's own endpoint, separate from /api/admin (which is
// Cardtly-staff only). Every write goes through canManageDepartment first, so
// a manager can only ever touch a department they manage. The permission
// boundary is enforced here, on the server; the UI only decides what to show.

function generateSlug(name: string, suffix: string): string {
  const base = (name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card'
  return `${base}-${suffix}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  const { action } = body

  // ── Owner-only: run the org's department structure ────────────────────────
  // These are the company's main-admin powers. A plain department manager must
  // never reach them, so they gate on org ownership, not canManageDepartment.

  if (action === 'create_department') {
    const { org_id, name } = body
    if (!org_id || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'A team and a name are required' }, { status: 400 })
    }
    if (!(await isOrgOwner(admin, user.id, org_id))) {
      return NextResponse.json({ error: 'Only the company admin can create departments' }, { status: 403 })
    }
    const { data, error } = await admin.from('departments')
      .insert({ organization_id: org_id, name: String(name).trim() }).select('id').maybeSingle()
    if (error) return NextResponse.json({ error: `Could not create it: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, department_id: data?.id })
  }

  if (action === 'rename_department') {
    const { department_id, name } = body
    if (!department_id || !name || !String(name).trim()) return NextResponse.json({ error: 'A department and a name are required' }, { status: 400 })
    if (!(await ownsOrgOfDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'Only the company admin can rename a department' }, { status: 403 })
    }
    const { error } = await admin.from('departments').update({ name: String(name).trim(), updated_at: new Date().toISOString() }).eq('id', department_id)
    if (error) return NextResponse.json({ error: `Could not rename: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete_department') {
    const { department_id } = body
    if (!department_id) return NextResponse.json({ error: 'department_id required' }, { status: 400 })
    if (!(await ownsOrgOfDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'Only the company admin can delete a department' }, { status: 403 })
    }
    // ON DELETE SET NULL: the cards survive and fall back to the company look.
    const { error } = await admin.from('departments').delete().eq('id', department_id)
    if (error) return NextResponse.json({ error: `Could not delete: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Appoint (or remove) a department head, by email so the owner never gets a
  // list of every Cardtly user.
  if (action === 'appoint_head') {
    const { department_id, email } = body
    if (!department_id || !email) return NextResponse.json({ error: 'A department and an email are required' }, { status: 400 })
    if (!(await ownsOrgOfDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'Only the company admin can appoint a head' }, { status: 403 })
    }
    const found = await findUserByEmail(admin, email)
    if (!found) {
      return NextResponse.json({ error: 'No Cardtly account with that email. Ask them to sign up first, then appoint them.' }, { status: 404 })
    }
    const { error } = await admin.from('department_managers')
      .upsert({ department_id, user_id: found.id }, { onConflict: 'department_id,user_id' })
    if (error) return NextResponse.json({ error: `Could not appoint: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, email: found.email })
  }

  if (action === 'remove_head') {
    const { department_id, user_id } = body
    if (!department_id || !user_id) return NextResponse.json({ error: 'department_id and user_id required' }, { status: 400 })
    if (!(await ownsOrgOfDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'Only the company admin can remove a head' }, { status: 403 })
    }
    const { error } = await admin.from('department_managers').delete().eq('department_id', department_id).eq('user_id', user_id)
    if (error) return NextResponse.json({ error: `Could not remove: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Set a department's look ───────────────────────────────────────────────
  if (action === 'set_brand') {
    const { department_id, brand } = body
    if (!department_id) return NextResponse.json({ error: 'department_id required' }, { status: 400 })
    if (!(await canManageDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'You do not manage that department' }, { status: 403 })
    }
    // Only ever persist real brand fields, so a caller cannot smuggle other
    // columns into the jsonb.
    const clean: Record<string, any> = {}
    for (const f of BRAND_FIELDS) if (brand && f in brand) clean[f] = brand[f]

    const { error } = await admin.from('departments')
      .update({ brand: clean, updated_at: new Date().toISOString() }).eq('id', department_id)
    if (error) return NextResponse.json({ error: `Could not save the look: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, brand: clean })
  }

  // ── Invite a member into a department ─────────────────────────────────────
  if (action === 'add_member') {
    const { department_id, name, email } = body
    if (!department_id) return NextResponse.json({ error: 'department_id required' }, { status: 400 })
    if (!(await canManageDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'You do not manage that department' }, { status: 403 })
    }
    const to = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'A valid email is required to invite someone' }, { status: 400 })
    }

    const { data: dept } = await admin.from('departments').select('id, organization_id, name').eq('id', department_id).maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 })

    // Seat limit is on the whole org, not the department. A manager filling
    // their department still consumes the company's seats.
    const { data: org } = await admin.from('organizations').select('id, name, max_seats').eq('id', dept.organization_id).maybeSingle()
    const { count } = await admin.from('team_cards').select('id', { count: 'exact', head: true }).eq('organization_id', dept.organization_id)
    if ((count || 0) >= (org?.max_seats || 0)) {
      return NextResponse.json({ error: 'The team is out of seats. Ask the main admin to add more.' }, { status: 400 })
    }

    const token = newInviteToken()
    const slug = generateSlug(name || 'card', Math.random().toString(36).slice(2, 7))
    const { data: card, error } = await admin.from('team_cards').insert({
      organization_id: dept.organization_id,
      department_id,
      name: name || '',
      slug,
      // Wears the department brand by default; that is the whole point of
      // inviting them into a department rather than the org.
      use_team_brand: true,
      invite_email: to,
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
    }).select('id, name').single()
    if (error) return NextResponse.json({ error: `Could not create the card: ${error.message}` }, { status: 500 })

    const { data: me } = await admin.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
    const sent = await sendTeamInvite({
      to, orgName: org?.name || 'the team', inviterName: me?.name || user.email || 'Your team manager',
      cardName: card.name || 'your team card', token,
    })
    return NextResponse.json({ success: true, card_id: card.id, emailed: sent.ok, emailError: sent.ok ? undefined : sent.error })
  }

  // ── Resend an invite ──────────────────────────────────────────────────────
  if (action === 'resend_invite') {
    const { team_card_id } = body
    if (!team_card_id) return NextResponse.json({ error: 'team_card_id required' }, { status: 400 })
    const loc = await cardDepartment(admin, team_card_id)
    if (!loc?.departmentId || !(await canManageDepartment(admin, user.id, loc.departmentId))) {
      return NextResponse.json({ error: 'You do not manage that card' }, { status: 403 })
    }
    const { data: card } = await admin.from('team_cards').select('id, name, invite_email, invite_token, organization_id, claimed_at').eq('id', team_card_id).maybeSingle()
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    if (card.claimed_at) return NextResponse.json({ error: 'They have already claimed it' }, { status: 409 })
    if (!card.invite_email) return NextResponse.json({ error: 'No email on file for this card' }, { status: 400 })

    const token = card.invite_token || newInviteToken()
    if (!card.invite_token) await admin.from('team_cards').update({ invite_token: token }).eq('id', team_card_id)
    await admin.from('team_cards').update({ invite_sent_at: new Date().toISOString() }).eq('id', team_card_id)

    const { data: org } = await admin.from('organizations').select('name').eq('id', card.organization_id).maybeSingle()
    const { data: me } = await admin.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
    const sent = await sendTeamInvite({ to: card.invite_email, orgName: org?.name || 'the team', inviterName: me?.name || user.email || 'Your team manager', cardName: card.name || 'your team card', token })
    return NextResponse.json({ success: true, emailed: sent.ok })
  }

  // ── Remove a member ───────────────────────────────────────────────────────
  // Only an UNCLAIMED invite can be removed here: deleting a claimed card is a
  // real person losing their live card, which is a bigger call that stays with
  // the main admin.
  if (action === 'remove_member') {
    const { team_card_id } = body
    if (!team_card_id) return NextResponse.json({ error: 'team_card_id required' }, { status: 400 })
    const loc = await cardDepartment(admin, team_card_id)
    if (!loc?.departmentId || !(await canManageDepartment(admin, user.id, loc.departmentId))) {
      return NextResponse.json({ error: 'You do not manage that card' }, { status: 403 })
    }
    const { data: card } = await admin.from('team_cards').select('claimed_at').eq('id', team_card_id).maybeSingle()
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    if (card.claimed_at) {
      return NextResponse.json({ error: 'This card has been claimed by a real person. Ask the main admin to remove a claimed member.' }, { status: 409 })
    }
    const { error } = await admin.from('team_cards').delete().eq('id', team_card_id)
    if (error) return NextResponse.json({ error: `Could not remove: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Move a card between departments the manager manages ───────────────────
  if (action === 'move_card') {
    const { team_card_id, to_department_id } = body
    if (!team_card_id) return NextResponse.json({ error: 'team_card_id required' }, { status: 400 })
    const loc = await cardDepartment(admin, team_card_id)
    if (!loc) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    // Must be allowed to take the card from where it is now. From a
    // department: you manage it. From the org level (no department): you own
    // the org. A manager cannot pull an org-level card in; only the owner can.
    const fromOk = loc.departmentId
      ? await canManageDepartment(admin, user.id, loc.departmentId)
      : (loc.organizationId ? await isOrgOwner(admin, user.id, loc.organizationId) : false)
    if (!fromOk) {
      return NextResponse.json({ error: 'You cannot move that card' }, { status: 403 })
    }
    // And, unless releasing it to the org level, must manage the target too.
    if (to_department_id && !(await canManageDepartment(admin, user.id, to_department_id))) {
      return NextResponse.json({ error: 'You do not manage the department you are moving it into' }, { status: 403 })
    }
    const { error } = await admin.from('team_cards').update({ department_id: to_department_id || null }).eq('id', team_card_id)
    if (error) return NextResponse.json({ error: `Could not move it: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// Read: everything the signed-in user may manage. Powers the dashboard.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const [managed, ownedOrgs] = await Promise.all([
    getManagedDepartments(admin, user.id),
    getOwnedOrgs(admin, user.id),
  ])
  return NextResponse.json({ departments: managed, ownedOrgs })
}
