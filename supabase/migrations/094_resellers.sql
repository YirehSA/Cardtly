-- 094: resellers. (Andre, 2026-10-21.)
--
-- A reseller is a company, a marketing agency say, that sells Cardtly to its
-- own clients at its own price. Cardtly gives it a pool of seats, it hands them
-- out to client teams, and Cardtly invoices it monthly for the seats it sold:
-- R70 a seat, every month, for as long as the client stays live. NFC cards it
-- buys are R50 blank (it prints them) or R125 printed by Cardtly, plus a
-- shipping amount set per reseller, R100 by default.
--
--   resellers                 the reseller, its pool and its prices. Billed
--                             through an ordinary billing_clients row, so its
--                             invoices are numbered, frozen, emailed and paid
--                             exactly like every other invoice.
--   reseller_members          the logins that run a reseller's page.
--   organizations.reseller_id the reseller a client team was sold by. With
--                             billing_period 'reseller' it is on that
--                             reseller's monthly invoice.
--   reseller_seat_months      the most seats each client had live in each
--                             month (SAST). "Any seat live that month is
--                             billed for the month" (Andre's choice), so this
--                             only ever goes up within a month, through
--                             reseller_record_seats below.
--   reseller_invoices         one row per reseller per month once that month
--                             is drafted. The primary key is what makes a
--                             double cron run unable to bill a month twice.
--   reseller_nfc_orders       NFC cards a reseller ordered. Each gets its own
--                             invoice straight away, and is made once paid.
--
-- Every table is service-role only (RLS on, no browser grants): the reseller
-- page and the admin both read and write through server routes.

-- ── Resellers ───────────────────────────────────────────────────────────────
create table if not exists public.resellers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  contact_name        text,
  email               text not null,
  phone               text,
  billing_client_id   uuid references public.billing_clients(id) on delete set null,
  seat_pool           integer not null default 0 check (seat_pool >= 0),
  seat_price_cents    integer not null default 7000 check (seat_price_cents >= 0),
  nfc_blank_cents     integer not null default 5000 check (nfc_blank_cents >= 0),
  nfc_printed_cents   integer not null default 12500 check (nfc_printed_cents >= 0),
  nfc_shipping_cents  integer not null default 10000 check (nfc_shipping_cents >= 0),
  status              text not null default 'active' check (status in ('active', 'suspended')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.resellers enable row level security;
grant select, insert, update, delete on public.resellers to service_role;

comment on table public.resellers is
  'Companies that resell Cardtly seats and NFC cards at their own price. Invoiced monthly for seats sold (see reseller_seat_months).';

-- ── Who runs a reseller ─────────────────────────────────────────────────────
create table if not exists public.reseller_members (
  reseller_id  uuid not null references public.resellers(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (reseller_id, user_id)
);
-- One reseller per login, so "which reseller is this?" has one answer.
create unique index if not exists reseller_members_one_per_user on public.reseller_members(user_id);
alter table public.reseller_members enable row level security;
grant select, insert, update, delete on public.reseller_members to service_role;

-- ── Client teams ────────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists reseller_id uuid references public.resellers(id) on delete set null;
create index if not exists organizations_reseller_idx on public.organizations(reseller_id);

comment on column public.organizations.reseller_id is
  'The reseller that sold this team. With billing_period reseller, its seats are on that reseller''s monthly invoice and the team sees no Cardtly prices.';

-- 'reseller' joins the modes 091 last wrote.
alter table public.organizations
  drop constraint if exists organizations_billing_period_check;
alter table public.organizations
  add constraint organizations_billing_period_check
  check (billing_period in ('monthly', 'yearly', 'debit_order', 'comp', 'trial', 'prepaid', 'reseller'));

-- ── Seats per client per month ──────────────────────────────────────────────
-- No foreign key to organizations on purpose: a client team deleted mid-month
-- still owes for the month it was live, and its name is kept for the invoice.
create table if not exists public.reseller_seat_months (
  reseller_id      uuid not null references public.resellers(id) on delete cascade,
  organization_id  uuid not null,
  month            date not null check (extract(day from month) = 1),
  peak_seats       integer not null default 0 check (peak_seats >= 0),
  client_name      text,
  updated_at       timestamptz not null default now(),
  primary key (reseller_id, organization_id, month)
);
alter table public.reseller_seat_months enable row level security;
grant select, insert, update, delete on public.reseller_seat_months to service_role;

-- Raise a client's count for the month, never lower it. One statement, so two
-- seat changes at the same moment cannot undo each other.
create or replace function public.reseller_record_seats(
  p_reseller uuid, p_org uuid, p_month date, p_seats integer, p_client_name text
) returns void
language sql
set search_path = public
as $$
  insert into public.reseller_seat_months (reseller_id, organization_id, month, peak_seats, client_name, updated_at)
  values (p_reseller, p_org, p_month, greatest(coalesce(p_seats, 0), 0), p_client_name, now())
  on conflict (reseller_id, organization_id, month) do update
    set peak_seats  = greatest(public.reseller_seat_months.peak_seats, excluded.peak_seats),
        client_name = coalesce(excluded.client_name, public.reseller_seat_months.client_name),
        updated_at  = now();
$$;
revoke all on function public.reseller_record_seats(uuid, uuid, date, integer, text) from public, anon, authenticated;
grant execute on function public.reseller_record_seats(uuid, uuid, date, integer, text) to service_role;

-- ── Months drafted ──────────────────────────────────────────────────────────
create table if not exists public.reseller_invoices (
  reseller_id  uuid not null references public.resellers(id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  invoice_id   uuid references public.invoices(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (reseller_id, month)
);
alter table public.reseller_invoices enable row level security;
grant select, insert, update, delete on public.reseller_invoices to service_role;

-- ── NFC orders ──────────────────────────────────────────────────────────────
create table if not exists public.reseller_nfc_orders (
  id                uuid primary key default gen_random_uuid(),
  reseller_id       uuid not null references public.resellers(id) on delete cascade,
  kind              text not null check (kind in ('blank', 'printed')),
  quantity          integer not null check (quantity between 1 and 10000),
  unit_cents        integer not null check (unit_cents >= 0),
  shipping_cents    integer not null default 0 check (shipping_cents >= 0),
  total_cents       integer not null check (total_cents >= 0),
  -- Printed orders: which client, and which of its cards (name, title, link).
  organization_id   uuid,
  client_name       text,
  cards             jsonb,
  notes             text,
  ship_to           jsonb not null,
  invoice_id        uuid references public.invoices(id) on delete set null,
  status            text not null default 'awaiting_payment'
                    check (status in ('awaiting_payment', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled')),
  tracking_number   text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists reseller_nfc_orders_reseller_idx on public.reseller_nfc_orders(reseller_id, created_at desc);
alter table public.reseller_nfc_orders enable row level security;
grant select, insert, update, delete on public.reseller_nfc_orders to service_role;

-- Proof: five tables with RLS on, the new column, and the constraint listing reseller.
select c.relname as table_name, c.relrowsecurity as rls_on
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('resellers', 'reseller_members', 'reseller_seat_months', 'reseller_invoices', 'reseller_nfc_orders')
 order by c.relname;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'organizations' and column_name = 'reseller_id';

select pg_get_constraintdef(oid) as billing_period_rule
  from pg_constraint
 where conname = 'organizations_billing_period_check';
