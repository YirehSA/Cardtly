-- 097: resellers sell each client monthly or yearly. (Andre, 2026-10-27:
-- "They must have the option to sell their cards as yearly or monthly. We need
-- to know what those are so we can invoice correctly.")
--
--   resellers.seat_price_year_cents   Cardtly's price to the reseller for one
--                                     seat for twelve months. Null means twelve
--                                     times the monthly price.
--   organizations.reseller_term       how a reseller's client is sold:
--                                     'monthly' (the default) or 'yearly'.
--   reseller_seat_months.term         how the client was sold in that month,
--                                     recorded with its seats, so a month is
--                                     invoiced the way it was sold.
--   reseller_client_years             each paid year: which client, the months
--                                     it covers and the seats billed when it
--                                     began. Months inside it are not billed
--                                     monthly.
--   reseller_year_extras              seats added during a paid year, billed
--                                     for the months it had left.
--
-- Both new tables are service-role only, like the rest of migration 094.

alter table public.resellers
  add column if not exists seat_price_year_cents integer check (seat_price_year_cents is null or seat_price_year_cents >= 0);

comment on column public.resellers.seat_price_year_cents is
  'Cardtly''s price to this reseller for one seat for twelve months, billed upfront. Null means twelve times seat_price_cents.';

alter table public.organizations
  add column if not exists reseller_term text not null default 'monthly'
  check (reseller_term in ('monthly', 'yearly'));

comment on column public.organizations.reseller_term is
  'For a reseller''s client: whether the reseller sold it monthly or yearly. Read by the reseller''s invoice, never by Paystack.';

alter table public.reseller_seat_months
  add column if not exists term text not null default 'monthly'
  check (term in ('monthly', 'yearly'));

-- The month's seats, now with how the client was sold. Seats still only rise
-- within a month; the term is whatever it was the last time it was recorded.
drop function if exists public.reseller_record_seats(uuid, uuid, date, integer, text);
create or replace function public.reseller_record_seats(
  p_reseller uuid, p_org uuid, p_month date, p_seats integer, p_client_name text, p_term text default 'monthly'
) returns void
language sql
set search_path = public
as $$
  insert into public.reseller_seat_months (reseller_id, organization_id, month, peak_seats, client_name, term, updated_at)
  values (p_reseller, p_org, p_month, greatest(coalesce(p_seats, 0), 0), p_client_name,
          case when p_term = 'yearly' then 'yearly' else 'monthly' end, now())
  on conflict (reseller_id, organization_id, month) do update
    set peak_seats  = greatest(public.reseller_seat_months.peak_seats, excluded.peak_seats),
        client_name = coalesce(excluded.client_name, public.reseller_seat_months.client_name),
        term        = excluded.term,
        updated_at  = now();
$$;
revoke all on function public.reseller_record_seats(uuid, uuid, date, integer, text, text) from public, anon, authenticated;
grant execute on function public.reseller_record_seats(uuid, uuid, date, integer, text, text) to service_role;

-- ── Paid years ──────────────────────────────────────────────────────────────
-- No foreign key to organizations, as with reseller_seat_months: a client
-- deleted mid-year still had that year paid for.
create table if not exists public.reseller_client_years (
  id               uuid primary key default gen_random_uuid(),
  reseller_id      uuid not null references public.resellers(id) on delete cascade,
  organization_id  uuid not null,
  client_name      text,
  start_month      date not null check (extract(day from start_month) = 1),
  end_month        date not null check (extract(day from end_month) = 1),
  seats            integer not null check (seats >= 0),
  unit_cents       integer not null check (unit_cents >= 0),
  created_at       timestamptz not null default now(),
  check (end_month >= start_month),
  unique (organization_id, start_month)
);
create index if not exists reseller_client_years_reseller_idx on public.reseller_client_years(reseller_id, start_month);
alter table public.reseller_client_years enable row level security;
grant select, insert, update, delete on public.reseller_client_years to service_role;

create table if not exists public.reseller_year_extras (
  year_id     uuid not null references public.reseller_client_years(id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  seats       integer not null check (seats > 0),
  months      integer not null check (months between 1 and 12),
  unit_cents  integer not null check (unit_cents >= 0),
  created_at  timestamptz not null default now(),
  primary key (year_id, month)
);
alter table public.reseller_year_extras enable row level security;
grant select, insert, update, delete on public.reseller_year_extras to service_role;

-- Proof: the new columns, the two tables with RLS on, and the six-argument function.
select table_name, column_name, column_default
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'resellers' and column_name = 'seat_price_year_cents')
     or (table_name = 'organizations' and column_name = 'reseller_term')
     or (table_name = 'reseller_seat_months' and column_name = 'term'))
 order by table_name;

select c.relname as table_name, c.relrowsecurity as rls_on
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('reseller_client_years', 'reseller_year_extras')
 order by c.relname;

select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'reseller_record_seats';
