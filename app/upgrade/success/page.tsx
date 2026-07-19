import Link from 'next/link'
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

export default async function UpgradeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan } = await searchParams
  const isYearly = plan === 'yearly'

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#000' }}>
      <div className="max-w-md w-full text-center relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />
        </div>
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
            <CheckCircle className="w-10 h-10" style={{ color: '#7c3aed' }} />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-3 text-white">
            You are now <span style={gradText}>Pro!</span>
          </h1>
          <p className="text-lg mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Welcome to the full Cardtly experience.</p>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {isYearly ? 'Your Pro plan is active for the next 12 months.' : 'Your Pro plan renews monthly. Cancel anytime from Settings.'}
          </p>
          <div className="rounded-2xl p-6 mb-8 text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              <Sparkles className="w-3 h-3" style={{ color: '#7c3aed' }} />
              What is now unlocked
            </p>
            <div className="space-y-2.5">
              {[
                '12 card templates — go to My Card to switch',
                'Analytics — see who viewed your card',
                'Email signature — generate yours now',
                'Virtual background — for Zoom & Teams',
                'Contact form — capture leads from your card',
                'QR code with your own logo',
              ].map(item => (
                <p key={item} className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>✓ {item}</p>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/dashboard"
              className="flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-white transition hover:opacity-90"
              style={{ background: grad, boxShadow: '0 8px 32px rgba(124,58,237,0.35)' }}>
              Go to dashboard <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/dashboard/card"
              className="py-3 rounded-2xl text-sm font-medium transition hover:bg-white/5 text-center"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              Customise my card now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
