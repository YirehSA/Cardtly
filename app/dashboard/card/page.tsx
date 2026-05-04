import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/plan-server'
import { redirect } from 'next/navigation'
import CardEditor from '@/components/card/CardEditor'

export const metadata = { title: 'My Card' }

export default async function CardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: card }, plan] = await Promise.all([
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single(),
    getUserPlan(user.id),
  ])

  // If no card exists, create one
  if (!card) {
    const firstName = user.email?.split('@')[0] || 'user'
    const slug = `${firstName}-${Math.random().toString(36).slice(2, 7)}`
    const { data: newCard } = await supabase
      .from('cards')
      .insert({
        user_id: user.id,
        name: firstName,
        email: user.email,
        slug,
        is_primary: true,
        color_theme: 'blue',
      })
      .select()
      .single()

    return <CardEditor card={newCard} plan={plan} userId={user.id} />
  }

  return <CardEditor card={card} plan={plan} userId={user.id} />
}
