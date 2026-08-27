import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { BRAND_FIELDS, extractBrand } from '@/lib/team-brand'
import { newTeamCardSlug, newTeamPersonSlug, orgIndustry } from '@/lib/card-slug-server'
import { slugifyPart, isReservedSlug } from '@/lib/card-slug'
import { isIndustryId } from '@/lib/industries'

// generateSlug used to live here and again in app/api/department/route.ts,
// with the two copies already drifted apart - this one truncated at 20 and
// left leading hyphens behind, which is how a card named " Schalk Jooste"
// ended up published at /card/-schalk-jooste-sicongroup. Both now come
// through lib/card-slug.ts.

// Paystack plan code per seat count, R97 per seat per month. These codes are
// the source of truth for what a customer is actually charged: Paystack bills
// the plan's own amount, so these must match the Paystack dashboard exactly.
// Self-serve stops at 20 seats; anything larger is Enterprise (debit order,
// handled off-Paystack).
const TEAM_PLANS: Record<number, string> = {
  2:  'PLN_b4p142hqlmvi8s7',
  3:  'PLN_3ajgivyuoolye2a',
  4:  'PLN_zvhgl8924o8kjcx',
  5:  'PLN_5a638dixfk2gt2w',
  6:  'PLN_4mupq84flla16kp',
  7:  'PLN_1d2cypagnp50abw',
  8:  'PLN_o80bf3ve1def10q',
  9:  'PLN_eqcge3ycapqbaow',
  10: 'PLN_edkkgzz8yo8w6s5',
  11: 'PLN_3kdvm8iwlzqzopf',
  12: 'PLN_s99vwbzagovvwkq',
  13: 'PLN_ex6p6x77dsnvcjo',
  14: 'PLN_oq65eahxlbk5zjl',
  15: 'PLN_2bzdrlydm3y4iyt',
  16: 'PLN_l8ponbzsauxrnob',
  17: 'PLN_omc0g8vbyhur9bt',
  18: 'PLN_5qjtw37i2q0tykg',
  19: 'PLN_0l6owsj7k9deuw1',
  20: 'PLN_q07zajjnp7gdmv0',
}

export const SEAT_PRICE_RAND = 97
export const MAX_SELF_SERVE_SEATS = 20

// Find plan code for an exact seat count. Above MAX_SELF_SERVE_SEATS there is
// no plan on purpose: those go to Enterprise.
function getPlanCode(seats: number): string | null {
  return TEAM_PLANS[seats] || null
}

// Kobo. Paystack takes the amount from the plan for subscriptions, so this is
// only a consistency check / fallback.
function getPlanAmount(seats: number): number {
  return TEAM_PLANS[seats] ? seats * SEAT_PRICE_RAND * 100 : 0
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const body = await request.json()
  const { action } = body

  // ── Create organization ────────────────────────────────────────────────────
  if (action === 'create_org') {
    const { org_name, seat_count } = body
    if (!org_name || !seat_count) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const planCode = getPlanCode(seat_count)
    if (!planCode) return NextResponse.json({ error: `Teams are 2 to ${MAX_SELF_SERVE_SEATS} seats. For more than ${MAX_SELF_SERVE_SEATS}, talk to us about Enterprise.` }, { status: 400 })

    // The org row is created before payment, so every abandoned checkout used
    // to leave one behind and every retry inserted another. Two rows was
    // enough to lock the admin out of their own team entirely, so reuse the
    // attempt they already started instead of stacking up new ones.
    const { data: existing } = await admin
      .from('organizations')
      .select('id, business_plan_active')
      .eq('admin_user_id', user.id)
      .order('business_plan_active', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing?.business_plan_active) {
      return NextResponse.json(
        { error: 'You already have a team. Use Add seats to make it bigger, rather than starting a second one.' },
        { status: 400 }
      )
    }

    // Note: organizations has no slug column (nothing reads an org slug), and
    // inserting one used to fail the whole create.
    const { data: org, error: orgError } = existing
      ? await admin
          .from('organizations')
          .update({ name: org_name, max_seats: seat_count, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single()
      : await admin
          .from('organizations')
          .insert({ admin_user_id: user.id, name: org_name, max_seats: seat_count, business_plan_active: false })
          .select()
          .single()

    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

    // Init Paystack subscription
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/team/verify?org_id=${org.id}&user_id=${user.id}&seat_count=${seat_count}`

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        amount: getPlanAmount(seat_count),
        plan: planCode,
        callback_url: callbackUrl,
        metadata: { org_id: org.id, user_id: user.id, seat_count, action: 'team_subscription' },
      }),
    })

    const ps = await res.json()
    if (!ps.status) return NextResponse.json({ error: ps.message }, { status: 500 })

    return NextResponse.json({ authorization_url: ps.data.authorization_url, org_id: org.id })
  }

  // ── Add team card ──────────────────────────────────────────────────────────
  if (action === 'add_card') {
    const { org_id, name, title, email, phone, company, copy_from_id } = body

    const { data: org } = await admin.from('organizations').select('id, max_seats').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { count } = await supabase.from('team_cards').select('*', { count: 'exact', head: true }).eq('organization_id', org_id)
    if ((count || 0) >= org.max_seats) return NextResponse.json({ error: 'Seat limit reached. Upgrade your plan to add more cards.' }, { status: 400 })

    const [slug, slugPerson, industry] = await Promise.all([
      newTeamCardSlug(admin, org_id, name || 'team'),
      newTeamPersonSlug(admin, org_id, name || 'team'),
      orgIndustry(admin, org_id),
    ])

    let cardFields: Record<string, any> = {
      organization_id: org_id,
      // Person half of /card/<company>/<person>, unused until the org has
      // companies configured.
      slug_person: slugPerson,
      name: name || '',
      title: title || null,
      email: email || null,
      phone: phone || null,
      company: company || null,
      slug,
      // Starts from the company's industry rather than blank. Every card here
      // belongs to one company doing one thing, and a field nobody fills in is
      // why the Network directory was full of companies listed as nothing.
      // Still editable per card afterwards.
      ...(industry ? { industry } : {}),
    }

    if (copy_from_id) {
      const { data: source } = await admin.from('team_cards').select('*').eq('id', copy_from_id).eq('organization_id', org_id).single()
      if (source) {
        cardFields = {
          ...cardFields,
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
    }

    const { data: card, error } = await admin.from('team_cards').insert(cardFields).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ card })
  }

  // ── Update team card ───────────────────────────────────────────────────────
  if (action === 'update_card') {
    const { org_id, card_id, ...fields } = body
    delete fields.action

    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    // Whatever the browser sends used to be spread straight into the update.
    // The WHERE clause scopes which row is hit, but not which columns are set,
    // so a crafted request could move a card into another organisation by
    // setting organization_id, or change the slug without writing the redirect
    // that keeps printed cards and NFC tags working. Same list as the one
    // /api/team/card/save enforces.
    for (const key of ['id', 'user_id', 'organization_id', 'department_id', 'slug',
                       'claimed_at', 'invite_email', 'invite_sent_at', 'view_count',
                       'is_active', 'created_at']) {
      delete fields[key]
    }
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { error } = await admin.from('team_cards').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', card_id).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Team brand (org-level, applies to all team cards) ───────────────────────
  // Save the brand (sanitised to brand fields only).
  if (action === 'save_team_brand') {
    const { org_id, brand } = body
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const clean: Record<string, any> = {}
    for (const f of BRAND_FIELDS) if (brand && f in brand) clean[f] = brand[f]

    const { error } = await admin.from('organizations').update({ brand: clean }).eq('id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, brand: clean })
  }

  // The company's identity: the prefix every team card URL carries, and the
  // industry new cards start from. Owner only - a department head sets their
  // department's look, not the company's name in every colleague's URL.
  if (action === 'save_org_identity') {
    const { org_id, card_slug_prefix, industry } = body
    const { data: org } = await admin
      .from('organizations').select('id, name').eq('id', org_id).eq('admin_user_id', user.id).maybeSingle()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const fields: Record<string, any> = {}

    if (card_slug_prefix !== undefined) {
      // Sanitised, never trusted. This ends up in the public URL of every card
      // the company owns.
      const prefix = slugifyPart(String(card_slug_prefix || ''), 24)
      if (!prefix || prefix.length < 2) {
        return NextResponse.json({ error: 'The company part needs at least 2 letters' }, { status: 400 })
      }
      if (isReservedSlug(prefix)) {
        return NextResponse.json({ error: `"${prefix}" is reserved. Pick another.` }, { status: 400 })
      }
      fields.card_slug_prefix = prefix
    }

    if (industry !== undefined) {
      // Empty clears it. Anything not on the fixed list is refused rather than
      // stored, so the Network's filters cannot fill up with free text.
      const value = industry ? String(industry) : null
      if (value && !isIndustryId(value)) {
        return NextResponse.json({ error: 'Unknown industry' }, { status: 400 })
      }
      fields.industry = value
    }

    if (!Object.keys(fields).length) return NextResponse.json({ success: true, unchanged: true })

    const { error } = await admin.from('organizations').update(fields).eq('id', org_id)
    if (error) {
      // Both columns arrive with migration 044. Until it runs, say so plainly
      // rather than returning a raw "column does not exist" to somebody
      // editing their company name.
      if ((error as any).code === '42703') {
        return NextResponse.json({ error: 'Not available yet: migration 044 has not been run on this database.' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Existing card URLs are deliberately NOT rewritten. They are printed on
    // NFC cards and in email signatures; changing the prefix changes what new
    // cards get, and nothing more.
    return NextResponse.json({ success: true, ...fields })
  }

  // Turn the team brand on/off for a single card.
  if (action === 'set_card_team_brand') {
    const { org_id, card_id, value } = body as { org_id?: string; card_id?: string; value?: boolean }
    if (!org_id || !card_id || typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { error } = await admin.from('team_cards').update({ use_team_brand: value }).eq('id', card_id).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, use_team_brand: value })
  }

  // Show/hide the team questionnaire on a single card. The form is built
  // once on the org; this just chooses which cards display it.
  if (action === 'set_card_questionnaire') {
    const { org_id, card_id, value } = body as { org_id?: string; card_id?: string; value?: boolean }
    if (!org_id || !card_id || typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { error } = await admin.from('team_cards').update({ use_team_questionnaire: value }).eq('id', card_id).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, use_team_questionnaire: value })
  }

  // Allocate a specific lead-capture form to one card. The forms live once in
  // the org library; this picks which one a given card shows:
  //   form_id 'off'      -> card shows no form (use_team_questionnaire = false)
  //   form_id 'default'  -> card shows the org's default (active) form
  //   form_id '<id>'     -> card shows that specific form from the library
  if (action === 'set_card_form') {
    const { org_id, card_id, form_id } = body as { org_id?: string; card_id?: string; form_id?: string }
    if (!org_id || !card_id || !form_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const { data: org } = await admin
      .from('organizations').select('id, addons').eq('id', org_id).eq('admin_user_id', user.id).maybeSingle()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    // Validate a real form id against the org library, so a card can never
    // point at a form that does not exist.
    if (form_id !== 'off' && form_id !== 'default') {
      const library = Array.isArray((org as any).addons?.questionnaires) ? (org as any).addons.questionnaires : []
      if (!library.some((f: any) => f.id === form_id)) {
        return NextResponse.json({ error: 'That form no longer exists' }, { status: 400 })
      }
    }

    const { data: card } = await admin
      .from('team_cards').select('addons').eq('id', card_id).eq('organization_id', org_id).maybeSingle()
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    const addons = { ...((card as any).addons || {}) }
    let useQ = true
    if (form_id === 'off') {
      useQ = false
    } else if (form_id === 'default') {
      delete addons.assignedFormId
    } else {
      addons.assignedFormId = form_id
    }

    const { error } = await admin.from('team_cards')
      .update({ addons, use_team_questionnaire: useQ })
      .eq('id', card_id).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, form_id })
  }

  // Apply (or remove) the team brand across every card at once.
  if (action === 'apply_brand_to_all') {
    const { org_id, value } = body as { org_id?: string; value?: boolean }
    if (!org_id || typeof value !== 'boolean') return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { error } = await admin.from('team_cards').update({ use_team_brand: value }).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Pull the brand straight from the admin's own card.
  if (action === 'import_brand_from_my_card') {
    const { org_id } = body
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { data: myCard } = await admin
      .from('cards').select('*').eq('user_id', user.id).eq('is_primary', true).maybeSingle()
    if (!myCard) return NextResponse.json({ error: 'You have no personal card to pull a brand from.' }, { status: 404 })

    const brand = extractBrand(myCard)
    const { error } = await admin.from('organizations').update({ brand }).eq('id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, brand })
  }

  // ── Delete team card ───────────────────────────────────────────────────────
  if (action === 'delete_card') {
    const { org_id, card_id } = body
    const { data: org } = await admin.from('organizations').select('id').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const { error } = await admin.from('team_cards').delete().eq('id', card_id).eq('organization_id', org_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Add seats (upgrade) ────────────────────────────────────────────────────
  if (action === 'add_seats') {
    const { org_id, new_seat_count } = body
    const { data: org } = await admin.from('organizations').select('*').eq('id', org_id).eq('admin_user_id', user.id).single()
    if (!org) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    const planCode = getPlanCode(new_seat_count)
    if (!planCode) return NextResponse.json({ error: `Teams are 2 to ${MAX_SELF_SERVE_SEATS} seats. For more than ${MAX_SELF_SERVE_SEATS}, talk to us about Enterprise.` }, { status: 400 })

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/team/verify?org_id=${org_id}&user_id=${user.id}&new_seat_count=${new_seat_count}`

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        amount: getPlanAmount(new_seat_count),
        plan: planCode,
        callback_url: callbackUrl,
        metadata: { org_id, user_id: user.id, new_seat_count, action: 'add_seats' },
      }),
    })

    const ps = await res.json()
    if (!ps.status) return NextResponse.json({ error: ps.message }, { status: 500 })
    return NextResponse.json({ authorization_url: ps.data.authorization_url })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
