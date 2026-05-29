import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import ClaimForm from './ClaimForm'

export const metadata = { title: 'Join your team' }

interface Props {
  params: Promise<{ token: string }>
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Look up the team card by invite_token. Bypass RLS because the
  // claim page is reached unauthenticated.
  const { data: card } = await admin
    .from('team_cards')
    .select('id, organization_id, name, invite_email, claimed_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!card) {
    return <InvalidLinkScreen />
  }

  if (card.claimed_at) {
    // Already accepted — send them to login
    redirect('/login?claimed=1')
  }

  // Resolve the org name for context
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', card.organization_id)
    .maybeSingle()

  const orgName = (org as any)?.name || 'your team'

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: '#000' }}>
      <div className="w-full max-w-md text-white">
        <div className="text-center mb-8">
          <div className="inline-block w-14 h-14 rounded-2xl mb-4 flex items-center justify-center font-black text-xl text-white"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)', boxShadow: '0 8px 30px rgba(124,58,237,0.4)' }}>
            C
          </div>
          <p className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#00d4ff' }}>You're invited</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Welcome to {orgName}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Your digital business card is ready. Set a password to sign in to Cardtly.
          </p>
        </div>

        <ClaimForm
          token={token}
          email={card.invite_email}
          cardName={card.name}
        />

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          By continuing you agree to the{' '}
          <a href="/terms" className="underline hover:text-white">Terms</a> and{' '}
          <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}

function InvalidLinkScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#000', color: '#fff' }}>
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-3">Invite link not found</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
          This invite link is invalid or has already been used. If you think this is wrong, ask your team admin to send a new invite.
        </p>
        <a href="/login" className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)' }}>
          Go to sign in
        </a>
      </div>
    </div>
  )
}
