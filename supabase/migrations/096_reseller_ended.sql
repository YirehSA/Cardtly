-- 096: a reseller can end. (Andre, 2026-10-21.)
--
-- A reseller's own card is free "for as long as they are a reseller", which
-- needs a way to stop being one that is not deleting the record: their
-- invoices, their seat history and the month still to bill all hang off it.
--
--   'ended'    no longer a reseller. Their page is read-only (invoices stay
--              downloadable), their free card stops (lib/reseller-comp), and
--              the last month they had clients is still invoiced on the 1st.
--   ended_at   when it happened.
--
-- 'active' and 'suspended' (on hold) are unchanged. No grants needed: the
-- table keeps the service-role grant 094 gave it.

alter table public.resellers drop constraint if exists resellers_status_check;
alter table public.resellers
  add constraint resellers_status_check check (status in ('active', 'suspended', 'ended'));

alter table public.resellers add column if not exists ended_at timestamptz;

-- Proof: the rule lists ended, and the column is there.
select pg_get_constraintdef(oid) as status_rule
  from pg_constraint
 where conname = 'resellers_status_check';
