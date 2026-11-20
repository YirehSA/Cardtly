-- 110: resellers sell Cardtly Solo. (Andre, 2026-11-20.)
--
-- Cardtly Solo is one person's card (lib/solo). A reseller can now sell it as
-- well as client teams: Cardtly charges the reseller R35 a month or R350 a
-- year for each Solo card, and the reseller charges its client what it likes.
--
-- A Solo client is a PERSON, not a team: a login with its own card. The
-- reseller adds them by name and email; the card is Solo because of a comped
-- whop_subscriptions row (tier 'solo', metadata.reason 'reseller_solo'), the
-- same way an admin comps anybody, so the dashboard and the public card page
-- serve it without knowing resellers exist (lib/reseller-solo).
--
-- Billing reuses everything client teams use. A Solo client's id goes where a
-- team's organization_id goes in reseller_seat_months and
-- reseller_client_years (neither has a foreign key, on purpose), always with
-- one seat, and the new product column says it is Solo so the invoice prices
-- it at the reseller's Solo price. Each Solo card takes one seat from the
-- reseller's pool and counts towards its level like any other card sold.
--
--   resellers.solo_price_cents        Cardtly's price to this reseller for a
--                                     Solo card for a month. R35 by default.
--   resellers.solo_price_year_cents   ...for twelve months upfront. R350.
--   reseller_solo_clients             the people a reseller sold Solo to.
--   reseller_seat_months.product      'pro' (a client team) or 'solo'.
--   reseller_client_years.product     the same, for paid years.
--
-- Service role only, like every reseller table (migration 094).

-- ── Prices ──────────────────────────────────────────────────────────────────
alter table public.resellers
  add column if not exists solo_price_cents integer not null default 3500 check (solo_price_cents >= 0);
alter table public.resellers
  add column if not exists solo_price_year_cents integer not null default 35000 check (solo_price_year_cents >= 0);

comment on column public.resellers.solo_price_cents is
  'Cardtly''s price to this reseller for one Cardtly Solo card for one month. R35 unless agreed otherwise.';
comment on column public.resellers.solo_price_year_cents is
  'Cardtly''s price to this reseller for one Cardtly Solo card for twelve months, billed upfront. R350 unless agreed otherwise.';

-- ── The people ──────────────────────────────────────────────────────────────
create table if not exists public.reseller_solo_clients (
  id           uuid primary key default gen_random_uuid(),
  reseller_id  uuid not null references public.resellers(id) on delete cascade,
  -- Null once the person deletes their account. Nothing is billed then.
  user_id      uuid references auth.users(id) on delete set null,
  name         text not null,
  email        text not null,
  term         text not null default 'monthly' check (term in ('monthly', 'yearly')),
  state        text not null default 'live' check (state in ('live', 'paused', 'cancelled')),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists reseller_solo_clients_reseller_idx on public.reseller_solo_clients(reseller_id, created_at);
-- One reseller's Solo per person at a time: two resellers (or one, twice)
-- billed for the same card would both be paying for one card.
create unique index if not exists reseller_solo_clients_one_per_user
  on public.reseller_solo_clients(user_id) where state <> 'cancelled' and user_id is not null;
alter table public.reseller_solo_clients enable row level security;
grant select, insert, update, delete on public.reseller_solo_clients to service_role;

comment on table public.reseller_solo_clients is
  'People a reseller sold Cardtly Solo to. One seat each from the reseller''s pool, on its monthly invoice at its Solo price.';

-- ── Which product a billed row is ───────────────────────────────────────────
alter table public.reseller_seat_months
  add column if not exists product text not null default 'pro' check (product in ('pro', 'solo'));
alter table public.reseller_client_years
  add column if not exists product text not null default 'pro' check (product in ('pro', 'solo'));

-- reseller_record_seats learns the product. Callers that do not pass it are
-- recording a client team, as before.
drop function if exists public.reseller_record_seats(uuid, uuid, date, integer, text, text);
create or replace function public.reseller_record_seats(
  p_reseller uuid, p_org uuid, p_month date, p_seats integer, p_client_name text,
  p_term text default 'monthly', p_product text default 'pro'
) returns void
language sql
set search_path = public
as $$
  insert into public.reseller_seat_months (reseller_id, organization_id, month, peak_seats, client_name, term, product, updated_at)
  values (p_reseller, p_org, p_month, greatest(coalesce(p_seats, 0), 0), p_client_name,
          case when p_term = 'yearly' then 'yearly' else 'monthly' end,
          case when p_product = 'solo' then 'solo' else 'pro' end, now())
  on conflict (reseller_id, organization_id, month) do update
    set peak_seats  = greatest(public.reseller_seat_months.peak_seats, excluded.peak_seats),
        client_name = coalesce(excluded.client_name, public.reseller_seat_months.client_name),
        term        = excluded.term,
        product     = excluded.product,
        updated_at  = now();
$$;
revoke all on function public.reseller_record_seats(uuid, uuid, date, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.reseller_record_seats(uuid, uuid, date, integer, text, text, text) to service_role;

-- Proof: the prices, the table with RLS on, the product columns, the function.
select column_name, column_default
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'resellers' and column_name in ('solo_price_cents', 'solo_price_year_cents'))
     or (table_name in ('reseller_seat_months', 'reseller_client_years') and column_name = 'product'))
 order by table_name, column_name;

select c.relname as table_name, c.relrowsecurity as rls_on
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'reseller_solo_clients';

select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'reseller_record_seats';
