-- Migration 082: close the last four public tables to the anon key
--
-- FOUND BY THE SUPABASE SECURITY ADVISOR, which flagged ops_alerts as CRITICAL
-- on 2026-09-15. The advisor names one table at a time. The repo was then swept
-- for every table that no migration ever puts RLS on, and there were four.
--
-- 078 ran this same sweep on 2026-09-14 by hand and found nfc_orders. It missed
-- these, which is the argument for doing it mechanically: "the obvious next
-- question was whether anything else was in the same state" was the right
-- question and got an incomplete answer. The sweep is now a script rather than
-- a careful read, and the script is what found the other three.
--
-- MEASURED AGAINST PRODUCTION on 2026-09-15 with NEXT_PUBLIC_SUPABASE_ANON_KEY,
-- the key that ships inside the site's JavaScript on every page. Read only,
-- counts only, no contents pulled:
--
--   table            GET /rest/v1/<table>   rows today
--   trial_codes      200 OK                 0
--   card_reports     200 OK                 0
--   network_blocks   200 OK                 0
--   ops_alerts       200 OK                 0
--
-- 200 OK, not 401. The door is open on all four. They are empty today, which
-- is luck and timing rather than protection, and 078 already said why that is
-- not a reason to wait: a hole is not less of a hole for being early. Each of
-- these fills the first time somebody uses the feature behind it.
--
-- WHAT EACH ONE LEAKS ONCE IT HAS ROWS
--
--   trial_codes     Every promo code, its length in days, whether it is
--                   active, its cap and its use count. Reading this table is
--                   reading the list of ways to get Pro without paying. This
--                   is the one that matters, and it is not the one the advisor
--                   called CRITICAL.
--
--   card_reports    Abuse reports: who reported which card, the reason and the
--                   free text detail, plus reporter_user_id when the reporter
--                   was signed in. The people best placed to report an
--                   impersonation are the ones being impersonated, and this
--                   would have shown the impersonator who turned them in.
--
--   network_blocks  Who has blocked whom, by user_id. A social graph of the
--                   relationships people specifically asked not to have.
--
--   ops_alerts      Operator alert throttle. Least sensitive to read, and the
--                   only one with an integrity angle: dedupe works by claiming
--                   the (kind, hour) row and treating 23505 as "already sent".
--                   Anyone who can insert can pre-claim the hour and the alert
--                   email is never sent. That is an attacker turning off the
--                   smoke detector, so it does belong in this migration even
--                   though its contents are dull.
--
-- ON WRITES. Nothing in 81 migrations revokes the default grants on these four
-- tables, so anon holds whatever Supabase grants by default and RLS being off
-- means nothing filters it. No write was attempted against production to
-- confirm this, deliberately: the fix is identical either way and testing it
-- would mean writing to a live table to prove a point.
--
-- SAME FIX AS 077 AND 078, and it costs nothing here for the same reason. All
-- eleven call sites across the four tables were checked and every one holds the
-- service role, which bypasses RLS:
--
--   trial_codes      api/trial-code/claim, api/admin, lib/admin-data
--   card_reports     api/network/report, api/admin/reports
--   network_blocks   api/network/block, dashboard/network/page.tsx
--   ops_alerts       lib/ai-failure.ts
--
-- No client component reads any of them. RLS on with zero policies closes them
-- completely and changes nothing about how the product behaves.
--
-- WHY NO POLICIES. A policy would only widen the surface again. Nothing in the
-- browser touches these tables, so there is no browser access to preserve.

do $$
declare
  t text;
  p record;
  n int := 0;
begin
  foreach t in array array['trial_codes', 'card_reports', 'network_blocks', 'ops_alerts']
  loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      raise notice 'dropping policy on %: %', t, p.policyname;
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
      n := n + 1;
    end loop;
  end loop;
  raise notice 'dropped % stray policy(ies)', n;
end $$;

alter table public.trial_codes    enable row level security;
alter table public.card_reports   enable row level security;
alter table public.network_blocks enable row level security;
alter table public.ops_alerts     enable row level security;

comment on table public.trial_codes is
  'Promo codes granting a trial. RLS is ON with no policies: claiming and managing codes both go through the service role in a server route, never from the browser. Before migration 082 the anon key could read every code.';

comment on table public.card_reports is
  'Abuse reports against public cards. RLS is ON with no policies: reports are filed and resolved through server routes holding the service role. Before migration 082 the anon key could read every report, including who filed it.';

comment on table public.network_blocks is
  'Who has blocked whom in the Network directory. RLS is ON with no policies: every read and write is server side through the service role. Before migration 082 the anon key could read the whole block graph.';

comment on table public.ops_alerts is
  'Throttle for operator alerts. One row per (kind, hour); a 23505 on insert means an alert for that kind already went out this hour. RLS is ON with no policies: only lib/ai-failure.ts writes here, through the service role. Before migration 082 anyone could pre-claim the hour and suppress the alert email.';

-- Proof, in the result pane. Every row must read rls_enabled = true and
-- policies_remaining = 0.
select
  c.relname                                        as table_name,
  c.relrowsecurity                                 as rls_enabled,
  (select count(*) from pg_policies pp
     where pp.schemaname = 'public'
       and pp.tablename = c.relname)               as policies_remaining
from pg_class c
join pg_namespace ns on ns.oid = c.relnamespace
where ns.nspname = 'public'
  and c.relname in ('trial_codes', 'card_reports', 'network_blocks', 'ops_alerts')
order by c.relname;
