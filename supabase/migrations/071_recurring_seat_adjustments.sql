-- Migration 071: remembering which seat change has already been charged for
--
-- 066 gave a schedule last_seats: what it billed on the last monthly invoice.
-- That is enough to notice a change and not enough to act on one, because
-- acting on it happens DAILY while last_seats only moves once a month.
--
-- Without a second marker, a team that goes from 10 seats to 15 on the 12th
-- gets a pro-rata invoice on the 12th, another on the 13th, another on the
-- 14th, and so on until the next monthly run - every one of them correct in
-- isolation and the set of them catastrophic.
--
-- So: last_seats stays "what we last BILLED on the monthly invoice", and
-- last_adjusted_seats becomes "what we have already accounted for, by any
-- means". The gap between the live count and last_adjusted_seats is the only
-- thing that can produce an adjustment, and closing it is what makes the daily
-- pass safe to run as often as it likes.

alter table public.recurring_schedules
  add column if not exists last_adjusted_seats integer;

-- Existing schedules are treated as already reconciled at whatever they last
-- billed. Leaving this null would make the first run after deploy raise a
-- pro-rata charge for a change that happened before anybody was watching for
-- one.
update public.recurring_schedules
   set last_adjusted_seats = last_seats
 where last_adjusted_seats is null
   and last_seats is not null;

comment on column public.recurring_schedules.last_seats is
  'Seats billed on the most recent MONTHLY invoice. Moves once a cycle.';
comment on column public.recurring_schedules.last_adjusted_seats is
  'Seats already accounted for by any means, monthly or a mid-cycle pro-rata adjustment. The daily pass compares the live count against THIS, which is what stops it raising the same top-up every day until month end.';
