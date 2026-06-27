import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import TeamBrandPanel from '@/components/team/TeamBrandPanel'

export const metadata = { title: 'Team Brand' }

export default async function TeamBrandPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: org } = await admin
    .from('organizations').select('id, name, brand').eq('admin_user_id', user.id).maybeSingle()
  if (!org) redirect('/dashboard/team')

  const brand = org.brand || {}
  const hasBrand = Object.keys(brand).length > 0

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/team" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" />{org.name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6" style={{ color: '#a855f7' }} />Team Brand
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">One brand, applied to every team card automatically</p>
        </div>
      </div>

      <TeamBrandPanel orgId={org.id} brand={brand} hasBrand={hasBrand} />
    </div>
  )
}
