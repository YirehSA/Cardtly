-- Trial reminder emails: one row per email actually sent.
--
-- The point of this table is idempotency. The reminder cron runs daily and
-- selects on a window ("trial ends within 7 days"), so the same person
-- matches that window on seven consecutive days. Without a record of what
-- has already gone out, they would be emailed every morning for a week.
--
-- The unique (user_id, kind) constraint is what enforces it, in the
-- database rather than in the route. The cron inserts the row FIRST and only
-- sends once the insert succeeds, so two overlapping runs cannot both send:
-- the second insert loses on the constraint. If the send then fails, the
-- route deletes its own row so the next run retries. That trades a small
-- risk of a duplicate (send succeeds, delete never happens) against the
-- worse failure of silently skipping someone's only warning.

create table if not exists public.trial_emails (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null check (kind in ('trial_7d', 'trial_1d', 'trial_expired')),
  sent_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- The cron's read path: "which of these users has already had this email?"
create index if not exists trial_emails_user_kind_idx
  on public.trial_emails (user_id, kind);

-- Written only by the cron, which uses the service-role key and bypasses
-- RLS. No policies are granted on purpose: nothing else, and no end user,
-- has any reason to read or write this table.
alter table public.trial_emails enable row level security;

comment on table public.trial_emails is
  'One row per trial reminder email sent. unique(user_id, kind) is what stops the daily cron re-sending the same reminder every day while a user sits inside the reminder window.';
