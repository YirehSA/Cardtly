-- 091: teams that pay in advance by invoice.
--
-- A client pays for 3 months up front (later perhaps 6, 12 or 36). The team
-- goes live when that invoice is marked paid, and carries a date it is paid
-- up to. At that date nothing switches off: it is flagged in admin and the
-- next invoice is sent (Andre, 2026-09-28).
--
--   organizations.paid_until       the last day this team has paid for.
--   'prepaid' billing_period       "Prepaid by invoice". Added to the check
--                                  constraint that 031 last rewrote.
--   invoices.prepaid_months        how many months this invoice buys. When it
--                                  is fully paid, the team linked to its client
--                                  is extended by this much.
--   invoices.prepaid_applied_at    set once the period has been added, so a
--                                  payment re-allocated or re-counted can never
--                                  add it twice.
--
-- No grants needed. organizations keeps its table-level select for
-- authenticated (084 revoked only writes), and invoices is service-role only;
-- new columns inherit both.

alter table public.organizations
  add column if not exists paid_until date;

comment on column public.organizations.paid_until is
  'Prepaid teams: the last day paid for. Extended by lib/prepaid when an invoice with prepaid_months is fully paid. Passing it does not take the team offline; it flags in admin.';

alter table public.organizations
  drop constraint if exists organizations_billing_period_check;
alter table public.organizations
  add constraint organizations_billing_period_check
  check (billing_period in ('monthly', 'yearly', 'debit_order', 'comp', 'trial', 'prepaid'));

alter table public.invoices
  add column if not exists prepaid_months integer
  check (prepaid_months is null or prepaid_months between 1 and 120);
alter table public.invoices
  add column if not exists prepaid_applied_at timestamptz;

comment on column public.invoices.prepaid_months is
  'Months of service this invoice buys for the team linked to its client. Applied once, when the invoice is fully paid.';
comment on column public.invoices.prepaid_applied_at is
  'When prepaid_months was added to the team''s paid_until. Never cleared: a period is added exactly once.';

-- Proof: three rows, and the constraint lists prepaid.
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'organizations' and column_name = 'paid_until')
     or (table_name = 'invoices' and column_name in ('prepaid_months', 'prepaid_applied_at')))
 order by table_name, column_name;

select pg_get_constraintdef(oid) as billing_period_rule
  from pg_constraint
 where conname = 'organizations_billing_period_check';
