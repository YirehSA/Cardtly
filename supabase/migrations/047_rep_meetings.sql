-- Migration 047: reps get a login, and somewhere to record their meetings
--
-- Reps exist today only as records in the admin panel: name, email, target,
-- commission. They have no login and nowhere to write anything down, so what
-- happened in a meeting lives in someone's head or in WhatsApp.
--
-- Two changes. reps.user_id links a rep record to an ordinary Cardtly account,
-- so a rep signs in the same way everyone else does and sees a Meetings panel
-- in the dashboard they already use - rather than us building and securing a
-- second login system for a handful of people. And rep_meetings is where the
-- meetings and notes go, visible to the rep who owns them and to admin.

alter table public.reps
  add column if not exists user_id uuid;

comment on column public.reps.user_id is
  'The Cardtly account this rep signs in with. NULL means the rep has not been given a login yet.';

-- One account cannot be two reps. Without this, linking the same login to two
-- rep records would make "whose meetings are these" unanswerable, and the
-- lookup by user_id would silently pick whichever row came back first.
-- Partial, so any number of reps may sit unlinked at NULL.
create unique index if not exists reps_user_id_unique
  on public.reps (user_id) where user_id is not null;

create table if not exists public.rep_meetings (
  id            uuid primary key default gen_random_uuid(),
  rep_id        uuid not null references public.reps(id) on delete cascade,

  -- Who they are seeing. Company is the only required detail: a rep logging a
  -- meeting on the way out of one should not be blocked for want of an email
  -- address, or they will not log it at all.
  company       text not null,
  contact_name  text,
  contact_phone text,
  contact_email text,

  scheduled_at  timestamptz not null,

  -- What happened to the appointment, and separately what came of it. See
  -- lib/rep-meetings.ts for why these are two columns.
  status        text not null default 'planned'
                  check (status in ('planned', 'done', 'no_show', 'cancelled')),
  outcome       text
                  check (outcome is null or outcome in ('signed', 'trial', 'follow_up', 'not_interested')),

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.rep_meetings is
  'Meetings logged by a sales rep, with notes. Owned by the rep via rep_id; admin sees all of them.';

-- The two ways this table is read: a rep opening their own list, and admin
-- opening one rep's history. Both are rep_id plus date order.
create index if not exists rep_meetings_rep_idx
  on public.rep_meetings (rep_id, scheduled_at desc);

-- Every read and write goes through the API with the service role, which checks
-- the caller owns the rep record first, so no policy is needed for the app
-- itself. RLS is on regardless: without it, any authenticated user could read
-- every rep's notes straight from the client using the anon key.
alter table public.rep_meetings enable row level security;
