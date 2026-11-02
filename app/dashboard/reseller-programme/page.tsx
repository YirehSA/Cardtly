import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/rep-access'
import { resellerProgrammeRole } from '@/lib/reseller-programme'
import ResellersTab from '@/components/admin/ResellersTab'

// The reseller programme, for the rep who runs it (reps.manages_resellers,
// switched in admin, Reps; lib/reseller-programme).
//
// The same screen as admin, Resellers, so a fix reaches both. In manager mode
// it hides what stays with Andre and Tio: the final approval, logins, ending a
// reseller and every invoice step. The API refuses those on its own, so this
// page being reachable never decides what he can change. Never in the iOS app:
// it is on IOS_BLOCKED_ROUTES, because it shows Cardtly's prices to resellers.

export const metadata = { title: 'Resellers' }
export const dynamic = 'force-dynamic'

export default async function ResellerProgrammePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await resellerProgrammeRole(serviceClient(), user.id)
  if (!role) redirect('/dashboard')

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="page-title">Resellers</h1>
        <p className="page-subtitle">
          {role === 'admin'
            ? 'The reseller programme as its manager sees it. Approving, logins and invoices are in admin, Resellers.'
            : 'Every reseller, their clients and NFC orders. Change pools, prices and details, and recommend new applications. Andre or Tio give the final approval and send the invoices.'}
        </p>
      </div>
      {/* The admin screen is drawn for a dark surface, so it gets one here in
          the light theme too. An admin sees it as the manager does; their own
          full screen is admin, Resellers. */}
      <div className="rounded-2xl p-3 sm:p-5" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)' }}>
        <ResellersTab role="manager" />
      </div>
    </div>
  )
}
