-- Migration 079: drop the three nfc_orders policies by name
--
-- 078 DID NOT TAKE. The read-only check still returned the row to the anon key
-- afterwards, and pg_policies explains why it was open in the first place:
--
--   policyname                          roles      cmd
--   Service role can manage all orders  {public}   ALL
--   Users can insert own orders         {public}   INSERT
--   Users can view own orders           {public}   SELECT
--
-- READ THE FIRST ONE AGAIN. It is named "Service role can manage all orders"
-- and it is granted to `public`, which in Postgres means every role, anon
-- included. It is a dashboard template applied with the wrong role, and its
-- name is the reason nobody caught it: anyone scanning the policy list reads
-- "service role" and moves on. The name describes the intent, the roles column
-- describes what it does, and they disagree.
--
-- The service role never needed a policy at all. It bypasses RLS entirely.
-- So this policy grants nothing to the role it names and everything to
-- everyone else.
--
-- Dropped BY NAME rather than through a loop this time, because 078's loop
-- did not run and an explicit statement either works or errors visibly.

drop policy if exists "Service role can manage all orders" on public.nfc_orders;
drop policy if exists "Users can insert own orders" on public.nfc_orders;
drop policy if exists "Users can view own orders" on public.nfc_orders;

alter table public.nfc_orders enable row level security;

comment on table public.nfc_orders is
  'Physical NFC card orders, including shipping addresses. RLS is ON with no policies: every access is through the service role in a server route, never from the browser. Before migration 079 a policy named "Service role can manage all orders" was granted to public, so the anon key could read every row, shipping address included.';

-- Proof. rls_enabled must be true and policies_remaining must be 0.
select
  (select relrowsecurity from pg_class where relname = 'nfc_orders') as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'nfc_orders') as policies_remaining;
