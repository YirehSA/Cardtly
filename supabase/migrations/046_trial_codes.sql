-- Migration 046: the free trial becomes something you hand out, not a default
--
-- Until now every new signup got 60 free days automatically, and not from any
-- code - `profiles.trial_ends_at` carries a database default of
-- `now() + 60 days`, so the trial was granted by the column itself. Nobody had
-- to be given anything.
--
-- From here a trial comes from a code. No code still lets someone sign up and
-- build a card; the card simply is not live until they pay.
--
-- EXISTING TRIALS ARE UNTOUCHED. A column default only applies to new rows, so
-- every current trial keeps the date it already has.

create table if not exists public.trial_codes (
  id          uuid primary key default gen_random_uuid(),
  -- Stored and compared uppercase, so CARDTLY30 and cardtly30 are one code.
  code        text not null unique,
  days        integer not null check (days between 1 and 365),
  active      boolean not null default true,
  -- Optional campaign end. NULL means it never expires on its own.
  expires_at  timestamptz,
  -- Optional cap. NULL means unlimited uses.
  max_uses    integer check (max_uses is null or max_uses > 0),
  uses        integer not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.trial_codes is
  'Reusable codes that grant a free trial at signup. A signup with no valid code gets no trial.';

-- Which code a person actually used, so a campaign can be measured and a
-- disputed trial can be traced back to the code that granted it.
alter table public.profiles
  add column if not exists trial_code text;

comment on column public.profiles.trial_code is
  'The trial code this account signed up with. NULL means they signed up without one.';

-- The important line in this migration.
--
-- With the default left at `now() + 60 days`, a signup that never reaches the
-- claim endpoint - a closed tab, a network drop, a failed request - would still
-- receive 60 free days, and the gate would leak on exactly the paths nobody
-- watches. Defaulting to now() means a new account starts with no trial and the
-- server has to grant one deliberately.
--
-- It fails closed: the worst case is someone who should have had a trial has to
-- be given one from the admin panel, rather than everyone silently getting one
-- free. planFromTrial treats NULL as "still trialing" (it fails open to avoid
-- taking a live card down), which is why this is now() and not NULL.
alter table public.profiles
  alter column trial_ends_at set default now();

-- The two codes to start with. ON CONFLICT so this migration can be re-run.
insert into public.trial_codes (code, days, notes)
values
  ('CARDTLY30', 30, 'Standard 30-day trial'),
  ('CARDTLY60', 60, 'Extended 60-day trial')
on conflict (code) do nothing;

-- Redemption is a read-modify-write on `uses`, so it runs as one statement in
-- the API rather than a select-then-update that two simultaneous signups could
-- interleave on. This index keeps the lookup on an uppercase code cheap.
create index if not exists trial_codes_code_idx on public.trial_codes (code);
