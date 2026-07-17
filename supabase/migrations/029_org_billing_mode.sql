-- How a team is actually billed.
--
-- organizations.billing_period was free text with no constraint, holding
-- 'monthly' for every team regardless of whether anyone was billing them. So
-- the admin showed Cardtly's own 50-seat org as R4,850/month of revenue that
-- does not exist and never will, and there was nowhere to record that a team
-- is on debit order rather than Paystack.
--
-- The four real modes:
--   monthly      self-serve Paystack, 2-20 seats, the normal path
--   yearly       same, billed annually
--   debit_order  Enterprise. Above 20 seats, invoiced and collected outside
--                Paystack entirely. Real revenue, but we collect it manually.
--   comp         free forever. Never billed, never counted as revenue.
--
-- The CHECK is the point: this column decides whether a team appears as money
-- coming in, so a typo must fail loudly rather than quietly misreport MRR.

alter table public.organizations
  drop constraint if exists organizations_billing_period_check;

-- Normalise anything unexpected before the constraint goes on, so applying
-- this cannot fail on existing data.
update public.organizations
   set billing_period = 'monthly'
 where billing_period is null
    or billing_period not in ('monthly', 'yearly', 'debit_order', 'comp');

alter table public.organizations
  add constraint organizations_billing_period_check
  check (billing_period in ('monthly', 'yearly', 'debit_order', 'comp'));

alter table public.organizations
  alter column billing_period set default 'monthly';

-- Free-text home for what an operator needs when collecting by hand: the
-- finance contact, a PO number, when the mandate was signed.
alter table public.organizations
  add column if not exists billing_notes text;

comment on column public.organizations.billing_period is
  'How this team is billed: monthly/yearly via Paystack, debit_order for Enterprise (collected manually, outside Paystack), or comp for free-forever teams. Only debit_order and monthly/yearly count as revenue.';
comment on column public.organizations.billing_notes is
  'Operator notes for teams billed outside Paystack: finance contact, PO number, mandate date.';
