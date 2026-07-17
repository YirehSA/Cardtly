-- Team trials, and knowing when to collect a debit order.
--
-- Two gaps this closes.
--
-- 1. You cannot trial a corporate. There is no billing mode for "free until
--    this date", so giving Acme two months meant marking them comped and
--    keeping the end date in your head.
--
-- 2. Nothing tells you a debit order is due. debit_order teams are invoiced
--    and collected by hand, outside Paystack, so without a record of when you
--    last collected, a team can quietly go months unbilled.
--
-- Deliberately NOT a gate. A lapsed team trial does not take a corporate's
-- cards offline: cutting fifty reps dead over a diary date ends the
-- relationship, and these are the accounts worth keeping. It flags, loudly,
-- and a human decides.

alter table public.organizations
  drop constraint if exists organizations_billing_period_check;

alter table public.organizations
  add constraint organizations_billing_period_check
  check (billing_period in ('monthly', 'yearly', 'debit_order', 'comp', 'trial'));

-- When a team trial runs out. Only meaningful while billing_period = 'trial'.
alter table public.organizations
  add column if not exists trial_ends_at timestamptz;

-- When we last actually collected from a debit-order team. NULL means never,
-- which for a debit_order team is itself the thing worth flagging.
alter table public.organizations
  add column if not exists last_collected_on date;

-- The read path: "which teams need attention". Both are small tables, but the
-- partial index keeps the intent obvious.
create index if not exists organizations_trial_ends_at_idx
  on public.organizations (trial_ends_at)
  where trial_ends_at is not null;

comment on column public.organizations.trial_ends_at is
  'When a team trial ends. Only meaningful while billing_period = trial. Deliberately NOT enforced: a lapsed team trial flags in admin, it never takes the team offline.';
comment on column public.organizations.last_collected_on is
  'Last time a debit_order team was actually collected from. NULL means never. Nothing collects automatically, so this is the only record that it happened.';
