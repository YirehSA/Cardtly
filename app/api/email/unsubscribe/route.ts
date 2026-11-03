import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isEmailKind, setOptOut, verifyOptOutToken } from '@/lib/email-optout'

// The unsubscribe link's two callers (lib/email-optout):
//
//   POST from the /unsubscribe page's button: u, k, t and action ('off' or
//   'on') in the form, and the person is sent back to the page to see it done.
//
//   POST from a mail client's own unsubscribe button (RFC 8058): u, k and t
//   in the query string, a body of "List-Unsubscribe=One-Click", and nobody to
//   send anywhere, so it answers 200.
//
// The signed token is the authority: it was made for this person and this
// kind, so no sign-in is needed. GET never changes anything, because security
// scanners open every link in an email; it forwards to the page instead.

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.redirect(new URL(`/unsubscribe${url.search}`, url), 303)
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  let form: FormData | null = null
  try { form = await request.formData() } catch { form = null }
  const field = (name: string) => {
    const v = form?.get(name)
    return typeof v === 'string' && v ? v : url.searchParams.get(name)
  }

  const u = field('u')
  const k = field('k')
  const t = field('t')
  const fromPage = form?.get('from') === 'page'
  const off = form?.get('action') !== 'on'
  const back = (extra: string) => NextResponse.redirect(
    new URL(`/unsubscribe?u=${encodeURIComponent(u || '')}&k=${encodeURIComponent(k || '')}&t=${encodeURIComponent(t || '')}&${extra}`, url), 303)

  if (!verifyOptOutToken(u, k, t) || !isEmailKind(k)) {
    return fromPage ? back('bad=1') : NextResponse.json({ error: 'This unsubscribe link is not valid.' }, { status: 400 })
  }

  const { error } = await setOptOut(admin(), u!, k, off)
  if (error) {
    console.error('unsubscribe failed', k, error)
    return fromPage ? back('failed=1') : NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }
  return fromPage ? back(`done=${off ? 'off' : 'on'}`) : NextResponse.json({ ok: true })
}
