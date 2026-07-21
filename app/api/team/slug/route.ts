import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { canManageDepartment } from '@/lib/department-perms'
import { composeCardSlug, orgSlugPrefix, slugifyPart, isReservedSlug } from '@/lib/card-slug'

// Setting a team card's URL.
//
// Three things changed here, all of which were live problems:
//
// 1. The company half is composed on the server from the organisation's
//    prefix. The caller sends the person's name only. Composing it client-side
//    would make the prefix a suggestion, and one person editing their own card
//    could quietly leave the company's naming behind.
//
// 2. Department heads may rename cards in their own department. Only the org
//    owner could before, so a head managing forty reps had to ask the account
//    owner to fix a typo in a URL.
//
// 3. A rename now writes a slug_redirects row, which /card/[slug] already
//    follows. It never did. Renaming a team card silently broke every NFC card
//    and printed QR code pointing at the old URL, with nothing to show for it
//    - the card simply 404'd for anyone holding the old one. The personal-card
//    route has always done this; the team one just did not.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { team_card_id } = body
    if (!team_card_id) return NextResponse.json({ error: 'team_card_id required' }, { status: 400 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    const { data: card } = await admin
      .from('team_cards')
      .select('id, slug, name, organization_id, department_id')
      .eq('id', team_card_id)
      .maybeSingle()
    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    // Who is asking. Mirrors /api/team/card/save: the org owner, or the head
    // of this card's department.
    const { data: org } = await admin
      .from('organizations')
      .select('id, name, admin_user_id, card_slug_prefix')
      .eq('id', card.organization_id)
      .maybeSingle()
    if (!org) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const isOwner = org.admin_user_id === user.id
    const isHead = !isOwner && card.department_id
      ? await canManageDepartment(admin, user.id, card.department_id)
      : false
    if (!isOwner && !isHead) {
      return NextResponse.json({ error: 'You cannot change that card\'s link' }, { status: 403 })
    }

    // card_slug_prefix arrives with migration 044. Until it is run the column
    // is simply absent, so fall back to deriving from the name rather than
    // dropping the company half entirely.
    const prefix = (org as any).card_slug_prefix || orgSlugPrefix(org.name)

    // The person's part. `person` is the field the UI sends; `slug` is accepted
    // so an older client mid-deploy still works, and is treated the same way -
    // as the person's half, never as the whole URL.
    const rawPerson = body.person ?? body.slug ?? ''
    const person = slugifyPart(String(rawPerson), 40)
    if (!person || person.length < 2) {
      return NextResponse.json({ error: 'Enter at least 2 characters of the person\'s name' }, { status: 400 })
    }

    const slug = composeCardSlug(prefix, person)
    if (slug === card.slug) return NextResponse.json({ success: true, slug, unchanged: true })
    if (isReservedSlug(slug)) {
      return NextResponse.json({ error: 'That link is reserved. Try another.' }, { status: 409 })
    }

    // maybeSingle, not single: single treats "nobody has this slug" as an
    // error, and the error was being discarded, so the taken-check only ever
    // worked by accident.
    const [{ data: takenPersonal }, { data: takenTeam }] = await Promise.all([
      admin.from('cards').select('id').eq('slug', slug).maybeSingle(),
      admin.from('team_cards').select('id').eq('slug', slug).neq('id', team_card_id).maybeSingle(),
    ])
    if (takenPersonal || takenTeam) {
      return NextResponse.json({ error: 'That link is already taken. Try adding a middle name.' }, { status: 409 })
    }

    const { error } = await admin
      .from('team_cards')
      .update({ slug, updated_at: new Date().toISOString() })
      .eq('id', team_card_id)
      .eq('organization_id', card.organization_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Only after the card actually moved. Writing the redirect first would
    // point the old URL at a slug that does not exist if the update fails.
    let redirected = false
    if (card.slug) {
      const { error: redirectError } = await admin
        .from('slug_redirects')
        .upsert({ old_slug: card.slug, new_slug: slug })
      if (redirectError) console.error('team slug redirect failed:', redirectError)
      else redirected = true
    }

    return NextResponse.json({ success: true, slug, previous: card.slug || null, redirected })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
