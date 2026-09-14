-- Migration 076: close whop_subscriptions to the public key
--
-- THE HOLE. Supabase's anon key ships inside the site's own JavaScript. That is
-- by design and it is safe only because row-level security stands behind it.
-- whop_subscriptions never had any: it appears in no earlier migration with an
-- `enable row level security` line, and it was created before that became the
-- habit here.
--
-- Tested against production on 2026-09-14 with the anon key and nothing else:
--
--   SELECT  all 20 rows, including email, user_id, status, plan_id and seats
--   INSERT  reached the table, refused only for a missing required column
--   UPDATE  a real row, HTTP 200, one row returned - permitted
--   DELETE  permitted
--
-- So anyone who opened the site's source could read the entire paying-customer
-- list with email addresses, grant themselves an active pro subscription by
-- inserting a row, cancel somebody else's, or delete all twenty.
--
-- NO POLICIES, which is the pattern the rest of this schema already uses. Every
-- read and write of this table goes through a server route or a server module
-- holding the service role, and the service role bypasses RLS. Adding a
-- "users can read their own" policy would widen the surface again for no gain,
-- because nothing in the browser reads this table.
--
-- ORDER MATTERS. Three call sites were reading or writing this table through a
-- USER-SCOPED client and had to move to the service role before this runs, or
-- they would have started returning nothing the moment it did:
--
--   lib/plan-server.ts            getUserPlan. Would have dropped every paying
--                                 customer to expired, which on 15 September
--                                 is the same day the free batch lapses.
--   app/dashboard/settings/page   would have shown a subscriber no subscription.
--   app/api/paystack/verify       would have taken the payment and never
--                                 activated it: money in, customer still on a
--                                 trial, and no error anywhere.
--
-- Those moved in the same commit as this file. Deploy first, then run this.

alter table public.whop_subscriptions enable row level security;

comment on table public.whop_subscriptions is
  'Subscriptions. RLS is ON with no policies: every access is through the service role in a server route, never from the browser. Before migration 076 the anon key could read, insert, update and delete every row.';
