-- 103: who has unsubscribed from which scheduled email.
--
-- POPIA section 69 needs a way out of every promotional email, and the weekly
-- summary and the trial emails had none (lib/email-optout). One row per person
-- per kind they have switched off; no row means they still get it. Removed
-- with the account through the foreign key.
--
-- Only the server reads or writes it: the signed unsubscribe link and the
-- Settings switches both go through server routes with the service role.

create table if not exists public.email_opt_outs (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('weekly_summary', 'trial_reminders')),
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.email_opt_outs enable row level security;

grant select, insert, update, delete on public.email_opt_outs to service_role;
