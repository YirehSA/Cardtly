-- Migration 090: a subscription can be cancelled and keep serving until the
-- end of the period it was paid for.
--
-- WHY. Cancelling was "get in touch and we will sort it out": the Settings
-- page's Manage subscription button went to the contact page. Self-service
-- cancellation needs somewhere to record the moment a cancelled subscription
-- stops entitling the account, because the Terms promise it takes effect "at
-- the end of the period you have paid for", not the instant the button is
-- pressed.
--
-- WHY A DATE AND NOT A NEW STATUS. status = 'active' is read as "subscribed"
-- in at least five places - the delete route, the admin screens, the sitemap,
-- the trial-reminder cron and the promotions report - and every one of them is
-- right to keep treating a paid-up customer as subscribed until the period
-- runs out. A new status value would have had to be taught to all of them.
-- Instead the row stays 'active', cancel_at says when that stops being true,
-- and the one function that decides entitlement - subscriptionState in
-- lib/plan-server, shared by the dashboard and the public card page - honours
-- it. The daily cron then moves the row to 'cancelled' once the date passes, so
-- the other readers catch up within a day.
--
-- A later successful payment clears it without anyone having to remember:
-- charge.success deletes and re-inserts the row, and the new row has no
-- cancel_at. Paying again is un-cancelling.
--
-- NO GRANT NEEDED. whop_subscriptions is written only by the service role,
-- whose table-level grant covers a new column; migration 085 revoked writes
-- from anon and authenticated, and this adds none back.

alter table public.whop_subscriptions
  add column if not exists cancel_at timestamptz;

comment on column public.whop_subscriptions.cancel_at is
  'When a cancelled subscription stops entitling the account: the end of the period already paid for. Set by /api/account/cancel-subscription. Null means not cancelled. The row stays active until then; subscriptionState in lib/plan-server enforces the date, and the daily cron moves the row to cancelled after it.';

-- Proof. Expected: one row, cancel_at, timestamp with time zone, nullable.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'whop_subscriptions'
   and column_name = 'cancel_at';
