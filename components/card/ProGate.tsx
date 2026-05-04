import Link from 'next/link'
import { Zap } from 'lucide-react'

interface Props {
  feature: string
}

export default function ProGate({ feature }: Props) {
  return (
    <div className="text-center py-10">
      <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Zap className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{feature}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
        Upgrade to Pro to unlock {feature.toLowerCase()} and everything else.
      </p>
      <Link
        href="/dashboard/upgrade"
        className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-foreground/90 transition"
      >
        <Zap className="w-4 h-4" />
        Upgrade to Pro
      </Link>
    </div>
  )
}
