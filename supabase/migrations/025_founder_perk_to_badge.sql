-- The first-100 perk becomes a badge, not free Pro.
--
-- Being one of the first 100 signups used to grant a 3-month Pro
-- subscription (plan_id 'founder_3m'). That grant stamped a period_end in
-- metadata that nothing ever read, so in practice it was free Pro forever.
--
-- From now on the perk is purely the "N/100" badge on the card. Those
-- accounts get the same 60-day trial as everyone else (migration 024 gives
-- every existing profile 60 days from the day it runs), and then they pay.
--
-- Cancelling the grant here is what drops them onto that trial, because the
-- plan gate only looks for an ACTIVE subscription before falling through to
-- the trial. Run this AFTER 024, so they land on a trial rather than an
-- expired account.
--
-- Scoped strictly to plan_id = 'founder_3m'. The deliberate comps
-- (pro_admin, comp, pro_gifted, pro_test, comped_play_review) and real
-- Paystack subscriptions are left alone.

update public.whop_subscriptions
   set status = 'cancelled',
       updated_at = now()
 where plan_id = 'founder_3m'
   and status = 'active';

-- profiles.founder_number and is_founder are intentionally kept: they are
-- what the badge renders. founder_lifetime_pro is now unused by the app (it
-- never granted access, it only styled a ribbon) and is left in place rather
-- than dropped, so no data is destroyed.
