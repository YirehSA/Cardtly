-- Migration 075: a rep's outreach log - emails, LinkedIn, networking
--
-- ONE TABLE, NOT THREE.
--
-- An email, a LinkedIn connection and a night at a networking evening are the
-- same shape: a company, a person, a date, what came of it, and what happens
-- next. Three tables carrying those five columns would need three routes, three
-- forms and a client-side merge every time anybody wants to see the week in
-- order - which is the main thing they will want. A fourth kind of outreach
-- would then be a migration instead of a line in a list.
--
-- Calls stay in rep_calls (migration 061) rather than moving in here. Their
-- vocabulary is genuinely different - eight outcomes about whether a phone was
-- answered - and moving live rows to make a diagram tidier is a risk taken for
-- nothing. The activity feed reads both and sorts them together.

create table if not exists public.rep_activities (
  id            uuid primary key default gen_random_uuid(),
  rep_id        uuid not null references public.reps(id) on delete cascade,

  kind          text not null default 'email'
                  check (kind in ('email', 'linkedin', 'networking')),

  -- Only the company is required, the same rule as calls and meetings. A rep
  -- who cannot log an activity for want of a surname they never caught will
  -- stop logging, and a half-filled log beats an empty one.
  company       text not null,
  contact_name  text,
  email         text,

  -- The subject line, or what the networking evening was called. One column
  -- because it answers the same question in both cases: which thing was this.
  subject       text,

  happened_at   timestamptz not null default now(),

  -- Statuses from every kind live in one column. Which ones are OFFERED for a
  -- given kind is decided in lib/rep-activities.ts and enforced by the API, so
  -- adding a status is one line there plus one line here.
  status        text not null default 'email_sent'
                  check (status in (
                    'email_sent', 'replied', 'not_interested', 'bounced',
                    'request_sent', 'connected', 'message_sent',
                    'attended', 'met_contacts',
                    'meeting_booked'
                  )),

  -- "Follow up - 15 Sep" in the mock is two facts, so it is two columns. The
  -- words are for a person to read; the date is what a query can find. Written
  -- together, they let the log answer "what is owed this week" without anybody
  -- parsing English.
  next_step     text,
  follow_up_on  date,

  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.rep_activities is
  'Outreach logged by a sales rep: emails, LinkedIn and networking. Owned via rep_id.';

-- The two reads: a rep opening their own log, and admin opening one rep's
-- history. Both are rep_id plus date order.
create index if not exists rep_activities_rep_idx
  on public.rep_activities (rep_id, happened_at desc);

-- "Who am I supposed to follow up" without scanning the table.
create index if not exists rep_activities_follow_up_idx
  on public.rep_activities (follow_up_on)
  where follow_up_on is not null;

-- Counting a month by kind, which is what every stat card on the page does.
create index if not exists rep_activities_kind_idx
  on public.rep_activities (rep_id, kind, happened_at desc);

-- Every read and write goes through the API with the service role, which
-- resolves the caller to a rep record first, so no policy is needed for the app
-- itself. RLS is on regardless: without it any authenticated user could read
-- every rep's outreach notes straight from the client with the anon key.
alter table public.rep_activities enable row level security;
