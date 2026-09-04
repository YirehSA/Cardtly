'use client'

import Link from 'next/link'
import { Zap } from 'lucide-react'
import { useIosApp } from '@/components/dashboard/PlatformProvider'

interface Props {
  feature: string
}

// What somebody sees where a Pro feature would be.
//
// In the iOS app it explains and stops. Apple's 3.1.1 forbids not only the
// checkout but any button or call to action pointing at a purchase that is not
// In-App Purchase, and "Upgrade to Pro" is exactly that. Naming the feature is
// still fair - the app is allowed to have features you do not have yet, it is
// just not allowed to sell them here.
export default function ProGate({ feature }: Props) {
  const iosApp = useIosApp()

  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
        <Zap className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{feature}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
        {iosApp
          ? `${feature} is part of Cardtly Pro. Your account does not have it at the moment.`
          : `Upgrade to Pro to unlock ${feature.toLowerCase()} and everything else.`}
      </p>
      {!iosApp && (
        <Link
          href="/dashboard/upgrade"
          className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-foreground/90 transition"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Pro
        </Link>
      )}
    </div>
  )
}
