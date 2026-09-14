-- Migration 077: drop the policies that were letting everyone into
-- whop_subscriptions
--
-- 076 WAS A NO-OP AND THIS IS THE ACTUAL FIX.
--
-- 076 ran `enable row level security` on the assumption that the table had
-- none. It already had it: pg_class.relrowsecurity was already true. Enabling
-- RLS is not what blocks anyone - a table with RLS on and a permissive policy
-- is wide open, and that is what this one is. After 076 ran, the anon key still
-- read every row.
--
-- Measured with the anon key, read-only, after 076:
--   SELECT -> HTTP 200, 19 rows, including email and user_id
--
-- So there is at least one policy on this table granting access to anon or to
-- public. It is not in any migration here, which means it was created in the
-- Supabase dashboard - most likely one of the "enable access for all users"
-- templates, applied early and never revisited.
--
-- ALL policies go, by name, whatever they turn out to be called. That is the
-- correct end state rather than a blunt one: every read and write of this table
-- now runs through the service role in a server route, and the service role
-- bypasses RLS entirely. A table with RLS on and zero policies is exactly the
-- pattern the rest of this schema uses. Nothing in the browser touches it -
-- check-entitlement-order fails the build if a client component so much as
-- names it.
--
-- The loop prints what it drops, so the Messages pane is the record of what
-- was wrong.

do $$
declare
  p record;
  n int := 0;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'whop_subscriptions'
  loop
    raise notice 'dropping policy: %', p.policyname;
    execute format('drop policy if exists %I on public.whop_subscriptions', p.policyname);
    n := n + 1;
  end loop;
  raise notice 'dropped % policy(ies)', n;
end $$;

-- Belt and braces: RLS must be on as well. Without it, no policies means no
-- restriction at all rather than total restriction.
alter table public.whop_subscriptions enable row level security;

-- Proof, in the result pane. Both must be true.
select
  (select relrowsecurity from pg_class where relname = 'whop_subscriptions') as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'whop_subscriptions') as policies_remaining;
