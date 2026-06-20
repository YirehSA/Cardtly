import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getOwnedContact } from '@/lib/contact-access'

// Edit a contact the signed-in user owns. Ownership is verified
// server-side via getOwnedContact - the body's id is never trusted
// on its own.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    id?: string; name?: string; title?: string; company?: string
    email?: string; phone?: string; website?: string; address?: string; notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body.id) return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'A name is required' }, { status: 400 })

  const owned = await getOwnedContact(user.id, body.id)
  if (!owned) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { error } = await admin
    .from('contacts')
    .update({
      name:    body.name.trim(),
      email:   body.email?.trim() || null,
      phone:   body.phone?.trim() || null,
      title:   body.title?.trim() || null,
      company: body.company?.trim() || null,
      website: body.website?.trim() || null,
      address: body.address?.trim() || null,
      message: body.notes?.trim() || null,
    })
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
