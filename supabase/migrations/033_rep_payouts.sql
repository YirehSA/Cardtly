-- Commission periods and what was actually paid.
--
-- The period runs from the 25th to the 25th, per Andre. Stored per rep rather
-- than as a constant so it can be changed without a deploy, and so a rep on a
-- different arrangement does not force everyone onto it.
--
-- Why the payout table exists, and this is the important part:
--
-- Commission is "R10 per card for as long as that client keeps paying", which
-- is a calculation over the CURRENT paying base. But whop_subscriptions has no
-- history: a row that goes active -> cancelled is UPDATED in place. So "who
-- was paying on 25 June" cannot be reconstructed, and a past period can never
-- be recalculated after the fact.
--
-- That means the number on the screen is only true on the day you look. Once
-- the 25th passes and a client churns, the figure moves and there is no way
-- back to what it was. Recording the payout freezes it: what the base was,
-- what was owed, and what was paid. From here forward there is a history;
-- before today there is none, and no migration can invent one.

alter table public.reps
  add column if not exists commission_day integer not null default 25
  check (commission_day between 1 and 28);

comment on column public.reps.commission_day is
  'Day of the month the commission period starts and ends. 25 means 25th to 25th. Capped at 28 so a period boundary exists in February.';

create table if not exists public.rep_payouts (
  id             uuid primary key default gen_random_uuid(),
  rep_id         uuid not null references public.reps(id) on delete cascade,
  -- The period this payout covers. Inclusive start, exclusive end.
  period_start   date not null,
  period_end     date not null,
  -- Frozen at the moment of recording, because it cannot be recomputed later.
  paying_cards   integer not null,
  target_cards   integer not null,
  billable_cards integer not null,
  rate_rand      integer not null,
  commission_rand integer not null,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  -- One payout per rep per period. Recording twice is a mistake, not a
  -- top-up, and this makes it fail loudly rather than double-pay.
  unique (rep_id, period_start)
);

create index if not exists rep_payouts_rep_idx
  on public.rep_payouts (rep_id, period_start desc);

-- Written and read only by the admin API via the service-role key. A rep's
-- payout history is not something any end user should read.
alter table public.rep_payouts enable row level security;

comment on table public.rep_payouts is
  'What a rep was owed for a period, frozen at the time of recording. Cannot be recomputed later: whop_subscriptions is updated in place and holds no history of who was paying on a given date.';
