import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { userOrgSlugPrefix } from '@/lib/card-slug-server'
import { composeCardSlug, slugifyPart, isReservedSlug } from '@/lib/card-slug'

// Setting a personal card's URL.
//
// A personal card carries no organisation, so the company has to be found
// through the person - see userOrgSlugPrefix. Someone who runs a company
// usually has a personal card rather than a team card (team cards are the
// seats they hand out), so without this the card most likely to be handed to a
// customer was the only one in the company not carrying the company name.
//
// Somebody with no company gets no prefix, which is most people, and is
// exactly how this behaved before.
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { card_id } = body

    // card_id must be a real UUID, not undefined or empty. Postgres will
    // throw "invalid input syntax for type uuid: 'undefined'" if we pass
    // anything else through to the .neq() / .eq() filters below.
    const isUuid = typeof card_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(card_id)
    if (!isUuid) {
      return NextResponse.json(
        { error: 'Your card is still loading. Refresh and try again.' },
        { status: 400 }
      )
    }

    // Service role for the lookups below. The taken-check has to see cards
    // this user cannot: asking through their own client means any slug owned
    // by somebody else reads as free, and the check passes on exactly the
    // collision it exists to catch.
    const admin = createServiceClient() as any

    const prefix = await userOrgSlugPrefix(admin, user.id)

    // `person` is what the UI sends; `slug` is accepted so a client mid-deploy
    // still works. Either way it is the person's half, never the whole URL -
    // the company half is composed here so it cannot be edited away.
    const person = slugifyPart(String(body.person ?? body.slug ?? ''), 40)
    if (!person || person.length < 2) {
      return NextResponse.json({ error: 'Your link needs at least 2 characters' }, { status: 400 })
    }

    const slug = composeCardSlug(prefix, person)
    if (isReservedSlug(slug)) {
      return NextResponse.json({ error: 'That link is reserved. Try another.' }, { status: 409 })
    }

    const { data: currentCard } = await admin
      .from('cards')
      .select('slug')
      .eq('id', card_id)
      .maybeSingle()

    if (currentCard?.slug === slug) {
      return NextResponse.json({ success: true, slug, unchanged: true })
    }

    const [{ data: takenPersonal }, { data: takenTeam }] = await Promise.all([
      admin.from('cards').select('id').eq('slug', slug).neq('id', card_id).maybeSingle(),
      admin.from('team_cards').select('id').eq('slug', slug).maybeSingle(),
    ])
    if (takenPersonal || takenTeam) {
      return NextResponse.json({ error: 'That link is already taken. Try another.' }, { status: 409 })
    }

    // Still scoped by user_id: the service client bypasses RLS, so ownership
    // has to be enforced here rather than assumed.
    const { error } = await admin
      .from('cards')
      .update({ slug, updated_at: new Date().toISOString() })
      .eq('id', card_id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Only after the card actually moved. Writing the redirect first would
    // point the old URL at a slug that does not exist if the update failed.
    let redirected = false
    if (currentCard?.slug) {
      const { error: redirectError } = await admin
        .from('slug_redirects')
        .upsert({ old_slug: currentCard.slug, new_slug: slug })
      if (redirectError) console.error('slug redirect failed:', redirectError)
      else redirected = true
    }

    return NextResponse.json({ success: true, slug, previous: currentCard?.slug || null, redirected })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
