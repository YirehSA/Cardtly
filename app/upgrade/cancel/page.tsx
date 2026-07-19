import Link from 'next/link'
import { XCircle, ArrowLeft, ArrowRight } from 'lucide-react'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'

const REASONS: Record<string, string> = {
  payment_failed: 'Your payment could not be processed. Please check your card details and try again.',
  missing_params: 'Something went wrong with the payment session. Please try again.',
  db_error: 'Your payment went through but we had trouble activating your account. Please contact support.',
  server_error: 'An unexpected error occurred. Please try again.',
}

export default async function UpgradeCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message = reason ? REASONS[reason] : 'You cancelled the payment. No charge was made.'

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#000' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <XCircle className="w-10 h-10" style={{ color: '#ef4444' }} />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-3 text-white">
          {reason ? 'Payment failed' : 'Payment cancelled'}
        </h1>
        <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>{message}</p>
        <div className="flex flex-col gap-3">
          <Link href="/dashboard/upgrade"
            className="flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
            style={{ background: grad }}>
            Try again <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/dashboard"
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
            <ArrowLeft className="w-4 h-4" />Back to dashboard
          </Link>
        </div>
        {reason === 'db_error' && (
          <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            If you were charged, please contact{' '}
            <a href="mailto:hello@cardtly.com" className="underline">hello@cardtly.com</a>{' '}
            and we will sort it out immediately.
          </p>
        )}
      </div>
    </div>
  )
}
