import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { BRAND_FIELDS } from '@/lib/team-brand'
import { LOCK_GROUP_IDS } from '@/lib/team-locks'
import { getManagedDepartments, canManageDepartment, cardDepartment, isOrgOwner, ownsOrgOfDepartment, findUserByEmail, getOwnedOrgs } from '@/lib/department-perms'
import { newInviteToken, sendTeamInvite } from '@/lib/team-invite'
import { newTeamCardSlug, orgIndustry } from '@/lib/card-slug-server'

// The department manager's own endpoint, separate from /api/admin (which is
// Cardtly-staff only). Every write goes through canManageDepartment first, so
// a manager can only ever touch a department they manage. The permission
// boundary is enforced here, on the server; the UI only decides what to show.

// The second copy of generateSlug lived here. See lib/card-slug.ts.

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
  // ── What a department's members may not change on their own card ──────────
  // The head of a department decides this for their own team, and the company
  // admin decides it for everyone. Enforced in /api/team/card/save, not here.
  if (action === 'set_locks') {
    const { department_id, locked } = body
    if (!department_id) return NextResponse.json({ error: 'department_id required' }, { status: 400 })
    if (!(await canManageDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'You do not manage that department' }, { status: 403 })
    }
    // Only ids we recognise are stored, so nothing arbitrary lands in the jsonb.
    const clean = Array.isArray(locked)
      ? [...new Set(locked.filter((id: unknown) => typeof id === 'string' && LOCK_GROUP_IDS.includes(id)))]
      : []
    const { error } = await admin.from('departments')
      .update({ locked_fields: clean, updated_at: new Date().toISOString() }).eq('id', department_id)
    if (error) return NextResponse.json({ error: `Could not save: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, locked: clean })
  }

  // Company-wide version, for the org admin. A department can add to this but
  // never remove from it.
  if (action === 'set_org_locks') {
    const { org_id, locked } = body
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })
    if (!(await isOrgOwner(admin, user.id, org_id))) {
      return NextResponse.json({ error: 'Only the company admin can set this' }, { status: 403 })
    }
    const clean = Array.isArray(locked)
      ? [...new Set(locked.filter((id: unknown) => typeof id === 'string' && LOCK_GROUP_IDS.includes(id)))]
      : []
    const { error } = await admin.from('organizations')
      .update({ locked_fields: clean, updated_at: new Date().toISOString() }).eq('id', org_id)
    if (error) return NextResponse.json({ error: `Could not save: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, locked: clean })
  }

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
    const [slug, industry] = await Promise.all([
      newTeamCardSlug(admin, dept.organization_id, name || 'card'),
      orgIndustry(admin, dept.organization_id),
    ])
    const { data: card, error } = await admin.from('team_cards').insert({
      organization_id: dept.organization_id,
      department_id,
      name: name || '',
      slug,
      // Inherits the company's industry rather than starting blank.
      ...(industry ? { industry } : {}),
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

  // ── Give yourself a card in a department you manage ───────────────────────
  //
  // A department head is appointed by the org owner and gets no card in the
  // process, so until now their only route to one was inviting their own email
  // through add_member and clicking the link in their own inbox. That works,
  // but it reads as a workaround, and every enterprise head hits it.
  //
  // Claimed on creation rather than emailed: the caller is already signed in
  // as the person the card is for, so a round trip through an invite token
  // would only be theatre.
  if (action === 'create_own_card') {
    const { department_id } = body
    if (!department_id) return NextResponse.json({ error: 'department_id required' }, { status: 400 })
    if (!(await canManageDepartment(admin, user.id, department_id))) {
      return NextResponse.json({ error: 'You do not manage that department' }, { status: 403 })
    }

    const { data: dept } = await admin
      .from('departments').select('id, organization_id, name').eq('id', department_id).maybeSingle()
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 })

    // One card each. Without this, every click makes another card and burns
    // another of the company's seats.
    const { data: existing } = await admin
      .from('team_cards')
      .select('id')
      .eq('organization_id', dept.organization_id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'You already have a card in this team' }, { status: 409 })
    }

    // Same seat rule as inviting anybody else: the cap is the organisation's,
    // not the department's, and it applies to the manager too.
    const { data: org } = await admin
      .from('organizations').select('id, max_seats').eq('id', dept.organization_id).maybeSingle()
    const { count } = await admin
      .from('team_cards').select('id', { count: 'exact', head: true }).eq('organization_id', dept.organization_id)
    if ((count || 0) >= (org?.max_seats || 0)) {
      return NextResponse.json({ error: 'The team is out of seats. Ask the main admin to add more.' }, { status: 400 })
    }

    const { data: me } = await admin.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
    const displayName = (me?.name || user.email?.split('@')[0] || 'My card').trim()

    const [ownSlug, ownIndustry] = await Promise.all([
      newTeamCardSlug(admin, dept.organization_id, displayName),
      orgIndustry(admin, dept.organization_id),
    ])

    const { data: card, error } = await admin.from('team_cards').insert({
      organization_id: dept.organization_id,
      department_id,
      name: displayName,
      email: user.email,
      slug: ownSlug,
      // Inherits the company's industry rather than starting blank.
      ...(ownIndustry ? { industry: ownIndustry } : {}),
      use_team_brand: true,
      user_id: user.id,
      invite_email: user.email,
      claimed_at: new Date().toISOString(),
    }).select('id, name, slug').single()

    if (error) return NextResponse.json({ error: `Could not create your card: ${error.message}` }, { status: 500 })
    return NextResponse.json({ success: true, card_id: card.id, slug: card.slug })
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

  // ── Allocate a lead-capture form to one card in a managed department ──────
  // Same semantics as the org-admin set_card_form: off / default / <formId>.
  if (action === 'set_card_form') {
    const { team_card_id, form_id } = body
    if (!team_card_id || !form_id) return NextResponse.json({ error: 'team_card_id and form_id required' }, { status: 400 })
    const loc = await cardDepartment(admin, team_card_id)
    if (!loc?.departmentId || !(await canManageDepartment(admin, user.id, loc.departmentId))) {
      return NextResponse.json({ error: 'You do not manage that card' }, { status: 403 })
    }
    // A card can only point at a form that exists in its org's library.
    if (form_id !== 'off' && form_id !== 'default') {
      const { data: org } = await admin.from('organizations').select('addons').eq('id', loc.organizationId).maybeSingle()
      const library = Array.isArray((org as any)?.addons?.questionnaires) ? (org as any).addons.questionnaires : []
      if (!library.some((f: any) => f.id === form_id)) {
        return NextResponse.json({ error: 'That form no longer exists' }, { status: 400 })
      }
    }
    const { data: card } = await admin.from('team_cards').select('addons').eq('id', team_card_id).maybeSingle()
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    const addons = { ...((card as any).addons || {}) }
    let useQ = true
    if (form_id === 'off') useQ = false
    else if (form_id === 'default') delete addons.assignedFormId
    else addons.assignedFormId = form_id
    const { error } = await admin.from('team_cards').update({ addons, use_team_questionnaire: useQ }).eq('id', team_card_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, form_id })
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
