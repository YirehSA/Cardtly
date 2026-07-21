import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/plan-server'
import { redirect } from 'next/navigation'
import CardEditor from '@/components/card/CardEditor'

export const metadata = { title: 'My Card' }

export default async function CardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use the admin client to look up the user's primary card. RLS can
  // hide rows from the regular client when the cards row was created
  // by another path (admin script, team invite, etc.) and the policy
  // doesn't quite match. Lookup with admin ensures we always find the
  // existing row before falling through to creating a duplicate.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Get the user's existing personal cards. If there are multiple
  // primary cards (data drift), pick the oldest stable one. If none
  // are marked primary, pick the oldest card the user owns. If they
  // own none at all, fall through to creating one.
  const { data: existingCards } = await admin
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  let card = (existingCards || []).find((c: { is_primary?: boolean | null }) => c.is_primary === true)
    || (existingCards || [])[0]
    || null

  const plan = await getUserPlan(user.id)

  // Team-member route: if the user has no personal card but DOES
  // own a claimed team card, send them to the team-card editor
  // (where the locked-field UI lives). Without this guard, we
  // would silently auto-create a duplicate empty personal card and
  // then prioritise it on the dashboard, hiding their real team
  // card from view.
  if (!card) {
    const { data: teamCard } = await admin
      .from('team_cards')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (teamCard) {
      redirect(`/dashboard/team/card/${teamCard.id}`)
    }
  }

  if (!card) {
    const firstName = user.email?.split('@')[0] || 'user'
    const slug = `${firstName}-${Math.random().toString(36).slice(2, 7)}`
    const { data: newCard, error: insertError } = await admin
      .from('cards')
      // assigned_user_id is what stops the card being archived on sight.
      // A BEFORE INSERT/UPDATE trigger in the database,
      // assert_card_assignment_consistency, does:
      //     IF NEW.assigned_user_id IS NULL THEN NEW.archived := true;
      // and the RLS policy that serves public cards only matches
      // archived = false. So a card created without an assignee is written
      // straight to archived, disappears from /card/[slug] with a 404, and
      // still looks perfectly healthy in the owner's dashboard - which reads
      // it as the owner rather than anonymously. That is how the 'andre' card
      // was dead for four days without anything reporting an error.
      .insert({
        user_id: user.id,
        assigned_user_id: user.id,
        name: firstName,
        email: user.email,
        slug,
        is_primary: true,
        color_theme: 'blue',
      } as any)
      .select()
      .single()

    if (insertError || !newCard) {
      console.error('Failed to create primary card for user', user.id, insertError)
      return (
        <div className="max-w-md mx-auto mt-20 p-6 rounded-2xl border border-destructive/30 bg-destructive/5">
          <h2 className="font-semibold text-lg mb-2 text-destructive">Could not load your card</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We could not create or fetch your personal card. Please email <a href="mailto:andre@cardtly.com" className="underline">andre@cardtly.com</a> with your account email and we will fix it manually.
          </p>
        </div>
      )
    }
    card = newCard
  }

  return <CardEditor card={card} plan={plan} userId={user.id} />
}
