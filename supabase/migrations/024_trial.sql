-- 60-day trial.
--
-- Cardtly no longer has a free tier. A new account gets 60 days that behave
-- exactly like Pro, and after that the account must pay or its card stops
-- serving. This column is the single source of truth for when that runs out.
--
-- SAFETY: every existing profile is backfilled to 60 days FROM NOW, not from
-- their signup date. Backfilling from created_at would expire every existing
-- account the moment this runs and take their live cards offline, including
-- cards people have already printed onto NFC. Existing users get a full 60
-- days from the day this ships, which is the decision that was made.
--
-- The gate treats a NULL trial_ends_at as "still trialing" on purpose, so a
-- row that somehow escapes this backfill can never silently kill a card.

alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

-- New signups get 60 days automatically, so the app never has to remember to
-- set it.
alter table public.profiles
  alter column trial_ends_at set default (now() + interval '60 days');

-- Existing accounts: 60 days from now. Only touches rows that have no date,
-- so this migration is safe to run more than once.
update public.profiles
   set trial_ends_at = now() + interval '60 days'
 where trial_ends_at is null;

-- Finding accounts whose trial is running out (for reminder emails later).
create index if not exists profiles_trial_ends_at_idx
  on public.profiles (trial_ends_at);

comment on column public.profiles.trial_ends_at is
  'When the 60-day trial ends. Past this date with no active subscription the account is expired and its public card stops serving. NULL is treated as still trialing.';
