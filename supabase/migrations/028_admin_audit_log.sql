-- A record of what admins actually did.
--
-- Every admin action runs with the service-role key, which bypasses RLS and
-- leaves no trace. Today you cannot answer "who deleted that account?",
-- "who comped this user?", or "who changed their password?" - not because the
-- answer is hidden, but because it was never written down. With more than one
-- admin, that is the difference between a mistake you can explain and one you
-- cannot.
--
-- Deliberately append-only in spirit: nothing in the app updates or deletes a
-- row here. target_user_id is NOT a foreign key on purpose, so deleting a user
-- does not delete the evidence that they were deleted.

create table if not exists public.admin_audit_log (
  id             uuid primary key default gen_random_uuid(),
  -- Who did it. FK to auth.users so an admin cannot be silently orphaned,
  -- but ON DELETE SET NULL: losing the admin must not lose the log.
  actor_user_id  uuid references auth.users(id) on delete set null,
  actor_email    text,
  -- What they did: the action string from /api/admin (activate_pro,
  -- delete_user, set_password, ...).
  action         text not null,
  -- Who it was done to. No FK: the row must survive the user's deletion,
  -- which is exactly the case you most want a record of.
  target_user_id uuid,
  target_email   text,
  -- Anything worth keeping: seat counts, old/new values, Paystack results.
  -- Never put a password or token in here.
  detail         jsonb not null default '{}'::jsonb,
  ok             boolean not null default true,
  created_at     timestamptz not null default now()
);

-- The two ways you actually read this: newest first, and "everything that
-- happened to this user".
create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_user_id, created_at desc);

-- Written and read only by the admin API via the service-role key, which
-- bypasses RLS. No policies granted on purpose: no end user has any reason to
-- read this.
alter table public.admin_audit_log enable row level security;

comment on table public.admin_audit_log is
  'Append-only record of admin actions. target_user_id is intentionally not a foreign key so the log survives deletion of the user it describes.';
