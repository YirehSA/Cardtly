-- Migration 085: two tables belong to the browser, the other eighty do not.
--
-- 083 fixed profiles, 084 fixed cards and organizations. This is the sweep
-- that says the same thing about everything else, because the default is the
-- problem: Supabase grants the authenticated role INSERT, UPDATE and DELETE on
-- every column of every table in public, and before 083 exactly one REVOKE
-- existed in 82 migrations. Every table added since has quietly carried it.
--
-- WHAT THE SWEEP FOUND. Every .insert/.update/.upsert/.delete in the app was
-- traced to the client that issues it, and each client to how it was made.
-- The rule that matters is that a server route is NOT privileged by virtue of
-- being a server route: createClient() runs as the signed-in user and is bound
-- by these grants exactly like the browser is, and only
-- createServiceClient() / createAdminClient(SERVICE_ROLE_KEY) escapes them.
--
-- Across all 82 tables, exactly TWO are ever written with the user's own role:
--
--   cards      signup's insert, CardEditor's update, SettingsTabs' industry,
--              and /api/cards/visibility (a server route, on the user's
--              client). Column grants set by 084.
--   profiles   signup's insert, SettingsTabs' name, /api/network/notice.
--              Column grants set by 083.
--
-- Everything else goes through the service role, including the cases that
-- looked like exceptions: the admin billing routes take their client from
-- adminDb(), lib/api-auth and lib/rep-access build their own from
-- SERVICE_ROLE_KEY, and the helpers that take `admin: any` as a parameter
-- (auditLog, saveActivity, enqueueLeadCreated, deliverPending,
-- sendPaymentFailedEmails) are called with one at every call site.
--
-- So for eighty tables the authenticated role holds three privileges it has
-- never once used, on tables holding invoices, payouts, subscriptions, trial
-- codes, webhooks, audit logs and every team card.
--
-- ANON GETS THE SAME TREATMENT, and needs it more: an anonymous visitor has no
-- business writing anything, anywhere. Nothing anonymous writes directly. The
-- public card's analytics and its lead capture both POST to a server route
-- that uses the service role, which is why neither appears in the sweep.
--
-- WHY A LOOP RATHER THAN EIGHTY REVOKE LINES. The list would be stale the day
-- somebody adds a table, and a table added later is exactly the one that would
-- carry the default unnoticed. This reads the catalogue instead, so it is
-- correct for whatever exists when it runs. Re-running it is harmless and is
-- the right thing to do after adding tables.
--
-- WHAT THIS DOES NOT TOUCH. SELECT, on either role. Read access is governed by
-- RLS and by migration 082, and changing it here would take the dashboard's
-- reads down. This is only about writes.
--
-- SEQUENCES are left alone too. A revoke on the table does not touch the
-- sequence behind a serial column, and nothing here inserts as these roles
-- anyway.

do $$
declare
  r record;
  -- The only two tables the browser legitimately writes. Their column grants
  -- are set by 083 and 084 and must survive this, so they are skipped for
  -- authenticated rather than revoked and granted back.
  browser_writes text[] := array['cards', 'profiles'];
  n_auth int := 0;
  n_anon int := 0;
begin
  for r in
    select tablename
      from pg_tables
     where schemaname = 'public'
     order by tablename
  loop
    -- anon never writes anything, including cards and profiles: signup does
    -- its inserts AFTER auth.signUp, so that session is authenticated.
    execute format('revoke insert, update, delete on public.%I from anon', r.tablename);
    n_anon := n_anon + 1;

    if not (r.tablename = any (browser_writes)) then
      execute format('revoke insert, update, delete on public.%I from authenticated', r.tablename);
      n_auth := n_auth + 1;
    end if;
  end loop;

  raise notice 'closed writes on % tables for authenticated (skipped %), % for anon',
    n_auth, array_to_string(browser_writes, ' and '), n_anon;
end $$;

-- Proof. Expected: exactly two rows, cards and profiles, with the column
-- counts 083 and 084 set. Anything else listed still has a write it does not
-- need, and any row for anon at all is a failure.
select grantee,
       table_name,
       privilege_type,
       count(*) as columns
  from information_schema.column_privileges
 where grantee in ('anon', 'authenticated')
   and table_schema = 'public'
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
 group by grantee, table_name, privilege_type
 order by grantee, table_name, privilege_type;
