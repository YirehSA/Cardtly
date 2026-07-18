import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { BRAND_FIELDS, extractBrand } from '@/lib/team-brand'

function generateSlug(name: string, suffix: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20) + '-' + suffix
}

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

    const slug = generateSlug(name || 'team', Math.random().toString(36).slice(2, 7))

    let cardFields: Record<string, any> = {
      organization_id: org_id,
      name: name || '',
      title: title || null,
      email: email || null,
      phone: phone || null,
      company: company || null,
      slug,
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
