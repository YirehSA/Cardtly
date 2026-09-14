-- Migration 078: close nfc_orders to the public key
--
-- FOUND WHILE WRITING THE SECURITY SUMMARY FOR THE WEDNESDAY MEETING, which is
-- the only reason it was found at all. 077 closed whop_subscriptions and the
-- obvious next question was whether anything else was in the same state. It
-- was.
--
-- Measured against production on 2026-09-14 with the anon key, read only:
--
--   table                real rows   anon can see
--   nfc_orders           1           1
--
-- The columns that come back include shipping_address, shipping_city,
-- shipping_province, shipping_postal_code, name_on_card, amount, status and
-- tracking_number. That is a physical delivery address for a named person,
-- readable by anyone who opens the site's JavaScript and finds the anon key,
-- which ships in the page by design.
--
-- One row is not the point. The table is the order book for physical NFC
-- cards, so it fills up with home and office addresses as the product sells,
-- and a hole is not less of a hole for being early.
--
-- SAME FIX AS 077, for the same reason: every access to this table is already
-- server side. All eight call sites were checked and none is a client
-- component:
--
--   app/api/nfc/order/route.ts        places an order
--   app/api/nfc/order/[id]/route.ts   one order
--   app/api/nfc/verify/route.ts       verifies a physical card
--   app/api/admin/route.ts            admin list
--   app/api/account/export/route.ts   the data subject's own copy
--   app/api/account/delete/route.ts   the deletion cascade
--   app/dashboard/nfc/page.tsx        server component
--   lib/admin-data.ts                 server module
--
-- So RLS on with no policies costs nothing and closes it completely. The
-- customer still sees their own order: that read goes through a server route
-- holding the service role, which bypasses RLS.
--
-- WHY NOT A "users can read their own orders" POLICY. Because nothing in the
-- browser reads this table, a policy would only widen the surface again. RLS
-- on with zero policies is the pattern the rest of this schema uses.

do $$
declare
  p record;
  n int := 0;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'nfc_orders'
  loop
    raise notice 'dropping policy: %', p.policyname;
    execute format('drop policy if exists %I on public.nfc_orders', p.policyname);
    n := n + 1;
  end loop;
  raise notice 'dropped % policy(ies)', n;
end $$;

alter table public.nfc_orders enable row level security;

comment on table public.nfc_orders is
  'Physical NFC card orders, including shipping addresses. RLS is ON with no policies: every access is through the service role in a server route, never from the browser. Before migration 078 the anon key could read every row, shipping address included.';

-- Proof, in the result pane. rls_enabled must be true and policies_remaining 0.
select
  (select relrowsecurity from pg_class where relname = 'nfc_orders') as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'nfc_orders') as policies_remaining;
