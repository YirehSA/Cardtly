import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { EMAIL_KINDS, isEmailKind, isOptedOut, verifyOptOutToken } from '@/lib/email-optout'

// Where the unsubscribe link in a scheduled email lands (lib/email-optout).
//
// Opening this page changes nothing. Email security scanners open every link
// in a message before the person does, so the change is a button, posted to
// /api/email/unsubscribe, which sends the person back here to see it done and
// to undo it if they pressed it by mistake.
//
// Plain on purpose: no site menu, no prices, nothing to sign up for. The
// person came here to stop an email.

export const metadata: Metadata = {
  title: 'Email preferences',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

interface Props {
  searchParams: Promise<{ u?: string; k?: string; t?: string; done?: string; bad?: string; failed?: string }>
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { u, k, t, done, bad, failed } = await searchParams
  const valid = !bad && verifyOptOutToken(u, k, t) && isEmailKind(k)

  let off: boolean | null = null
  if (valid) {
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
    off = await isOptedOut(admin, u!, k as keyof typeof EMAIL_KINDS)
  }
  // What the person just did wins over a read that may lag behind it.
  if (done === 'off') off = true
  if (done === 'on') off = false

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-16" style={{ background: '#000', color: '#fff' }}>
      <Link href="/" className="mb-8" aria-label="Cardtly home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cardtly-icon.png" alt="Cardtly" width={64} height={64} className="rounded-full" />
      </Link>

      <div className="w-full max-w-md rounded-3xl p-7 sm:p-8"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
        {!valid ? (
          <>
            <h1 className="text-2xl font-black tracking-tight mb-3">This link is not complete</h1>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
              It may have been cut short when it was copied. Sign in and open <strong className="text-white">Settings, Emails</strong> to choose what we send you.
            </p>
            <Link href="/dashboard/settings"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: grad }}>
              Open Settings
            </Link>
          </>
        ) : (
          <Choice u={u!} k={k as keyof typeof EMAIL_KINDS} t={t!} off={off === true} justChanged={!!done} failed={!!failed} />
        )}
      </div>

      <p className="mt-6 text-xs text-center max-w-md" style={{ color: 'rgba(255,255,255,0.4)' }}>
        This only covers the email named above. Lead alerts, meeting requests, invoices and sign-in emails still arrive.
      </p>
    </main>
  )
}

function Choice({ u, k, t, off, justChanged, failed }: {
  u: string; k: keyof typeof EMAIL_KINDS; t: string; off: boolean; justChanged: boolean; failed: boolean
}) {
  const kind = EMAIL_KINDS[k]
  return (
    <>
      {failed && (
        <p role="alert" className="mb-4 text-sm rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>
          That did not save. Please try again in a moment.
        </p>
      )}
      {off ? (
        <>
          <h1 className="text-2xl font-black tracking-tight mb-3">You are unsubscribed</h1>
          <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
            You will not get {kind.label} from us again.
          </p>
          {k === 'trial_reminders' && (
            <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Your trial still ends on the same day, and a card that is not on a paid plan goes offline then. You just will not get an email about it.
            </p>
          )}
          <form method="post" action="/api/email/unsubscribe" className="mt-6">
            <Hidden u={u} k={k} t={t} action="on" />
            <button type="submit" className="w-full py-3 rounded-xl text-sm font-semibold transition hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)' }}>
              {justChanged ? 'Pressed it by mistake? Turn it back on' : 'Turn it back on'}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black tracking-tight mb-3">
            {justChanged ? `${kind.title} is back on` : `Stop ${kind.label}?`}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{kind.detail}</p>
          <form method="post" action="/api/email/unsubscribe" className="mt-6">
            <Hidden u={u} k={k} t={t} action="off" />
            <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: grad }}>
              Unsubscribe
            </button>
          </form>
        </>
      )}
      <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
        You can also change this any time in <Link href="/dashboard/settings" className="underline">Settings, Emails</Link>.
      </p>
    </>
  )
}

function Hidden({ u, k, t, action }: { u: string; k: string; t: string; action: 'on' | 'off' }) {
  return (
    <>
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="k" value={k} />
      <input type="hidden" name="t" value={t} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="from" value="page" />
    </>
  )
}
