-- 048: what a calendar needs from a meeting.
--
-- 047 gave a meeting a single point in time, which is all a list needs. A week
-- or day view draws blocks, and a block without a length has to be guessed at,
-- so duration is stored rather than assumed.
--
-- follow_up_on exists because the 'follow_up' outcome had nowhere to record
-- WHEN. A rep marking "needs follow-up" with no date is writing a reminder
-- nobody will ever be reminded by.

alter table public.rep_meetings
  add column if not exists duration_minutes integer not null default 60
    check (duration_minutes between 5 and 1440);

alter table public.rep_meetings
  add column if not exists location text;

alter table public.rep_meetings
  add column if not exists follow_up_on date;

-- Partial: the only rows worth scanning are the ones with a follow-up pending.
create index if not exists rep_meetings_follow_up_idx
  on public.rep_meetings (follow_up_on)
  where follow_up_on is not null;
