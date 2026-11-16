-- Reseller levels (Andre, 2026-11-16): Starter, then Bronze at 100 cards
-- sold, Silver at 250, Gold at 500 and Platinum at 1000.
--
-- The level itself is worked out from cards ever sold (lib/reseller-levels,
-- read from reseller_seat_months), so the Reseller page and admin show it
-- before this runs. These columns only remember what has been announced:
--
--   level               the last level the reseller and Cardtly were emailed
--                       about. Only ever raised, compare-and-set, so a level
--                       is announced once however often the daily run goes.
--   level_reached_at    when that happened.
--   level_nudged_month  the month the "how close you are" email last went
--                       out. Starts at the month this runs (and, for a new
--                       reseller, the month it was added), so nobody is
--                       emailed until the next 1st.
--
-- No new table, so no new grants: resellers is already closed to the browser
-- (094) and written by the service role only.

alter table public.resellers
  add column if not exists level text not null default 'starter'
  check (level in ('starter', 'bronze', 'silver', 'gold', 'platinum'));

alter table public.resellers
  add column if not exists level_reached_at timestamptz;

alter table public.resellers
  add column if not exists level_nudged_month date
  default (date_trunc('month', now() at time zone 'Africa/Johannesburg'))::date;
