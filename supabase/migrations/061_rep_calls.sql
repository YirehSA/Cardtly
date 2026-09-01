-- Migration 061: a rep's call log
--
-- Separate from rep_meetings on purpose. A meeting is a plan - it has a length,
-- it sits on a grid, and there are two of them a week. A call is a record: it
-- happened, it took a moment, and there are thirty of them a day. Put both on
-- one calendar and the meetings disappear under the calls.
--
-- They meet at the outcome. "Meeting booked" is what a call is for, and it is
-- how the log explains where a meeting in the calendar came from.

create table if not exists public.rep_calls (
  id            uuid primary key default gen_random_uuid(),
  rep_id        uuid not null references public.reps(id) on delete cascade,

  -- Who was called. Only the company is required, same rule as a meeting: a rep
  -- logging a call between two others must not be stopped for want of a surname
  -- they never caught, or they will stop logging.
  company       text not null,
  contact_name  text,
  phone         text,

  -- When the call was made. Defaults to now because that is when it is nearly
  -- always written down, but editable - a morning's calls get logged at lunch.
  called_at     timestamptz not null default now(),

  outcome       text not null default 'answered'
                  check (outcome in (
                    'answered', 'no_answer', 'voicemail', 'callback',
                    'meeting_booked', 'signed', 'not_interested', 'wrong_number'
                  )),

  -- The date to ring back on. Belongs with the outcome rather than beside it:
  -- "call back later" with no when is a note to nobody.
  follow_up_on  date,

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.rep_calls is
  'Calls logged by a sales rep. Owned by the rep via rep_id; admin sees all of them.';

-- The two ways this is read: a rep opening their own log, and admin opening one
-- rep''s history. Both are rep_id plus date order.
create index if not exists rep_calls_rep_idx
  on public.rep_calls (rep_id, called_at desc);

-- Answering "who is due a call back" without scanning the table.
create index if not exists rep_calls_follow_up_idx
  on public.rep_calls (follow_up_on)
  where follow_up_on is not null;

-- Every read and write goes through the API with the service role, which checks
-- the caller owns the rep record first, so no policy is needed for the app
-- itself. RLS is on regardless: without it, any authenticated user could read
-- every rep's call notes straight from the client using the anon key.
alter table public.rep_calls enable row level security;
