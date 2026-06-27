import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { BRAND_FIELDS, extractBrand } from '@/lib/team-brand'

function generateSlug(name: string, suffix: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20) + '-' + suffix
}

// Team plan codes — R65 per seat per month
const TEAM_PLANS: Record<number, string> = {
  5:  'PLN_b4p142hqlmvi8s7',
  10: 'PLN_3ajgivyuoolye2a',
  15: 'PLN_zvhgl8924o8kjcx',
  20: 'PLN_5a638dixfk2gt2w',
  25: 'PLN_4mupq84flla16kp',
  30: 'PLN_1d2cypagnp50abw',
  40: 'PLN_o80bf3ve1def10q',
  50: 'PLN_eqcge3ycapqbaow',
}

// Seat tier amounts in kobo (R65 per seat)
const TEAM_AMOUNTS: Record<number, number> = {
  5:  32500,
  10: 65000,
  15: 97500,
  20: 130000,
  25: 162500,
  30: 195000,
  40: 260000,
  50: 325000,
}

// Find plan code for exact seat tier
function getPlanCode(seats: number): string | null {
  return TEAM_PLANS[seats] || null
}

function getPlanAmount(seats: number): number {
  return TEAM_AMOUNTS[seats] || 0
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
    if (!planCode) return NextResponse.json({ error: 'Seat count must be between 1 and 50' }, { status: 400 })

    const slug = generateSlug(org_name, Math.random().toString(36).slice(2, 6))

    // Create org
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ admin_user_id: user.id, name: org_name, slug, max_seats: seat_count, business_plan_active: false })
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
    if (!planCode) return NextResponse.json({ error: 'Invalid seat count' }, { status: 400 })

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
