import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/plan-server'
import { redirect } from 'next/navigation'
import QRPage from '@/components/card/QRPage'

export const metadata = { title: 'QR Code' }

export default async function QRCodePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: card }, plan] = await Promise.all([
    supabase
  .from('cards')
  .select('slug, name, profile_image_url, company_logo_url, color_theme')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single(),
    getUserPlan(user.id),
  ])

  if (!card?.slug) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-muted-foreground">No card found. Create your card first.</p>
      </div>
    )
  }

  return <QRPage card={card} plan={plan} />
}
