'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlan } from '@/types/database'
import { LogOut, User } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  user: { email: string; name?: string | null; avatar?: string | null }
  plan: UserPlan
}

export default function DashboardHeader({ user, plan }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isPro = plan.tier === 'pro' && plan.isActive

  async function signOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 lg:px-8 flex-shrink-0">
      {/* Mobile logo */}
      <div className="lg:hidden font-display font-bold text-lg">Cardtly</div>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        {/* Plan badge */}
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isPro
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground'
        }`}>
          {isPro ? 'Pro' : 'Free'}
        </span>

        {/* Avatar */}
        <div className="flex items-center gap-2">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || user.email}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <span className="hidden sm:block text-sm font-medium truncate max-w-32">
            {user.name || user.email}
          </span>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
