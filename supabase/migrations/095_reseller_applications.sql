-- 095: applying to become a reseller. (Andre, 2026-10-21.)
--
-- cardtly.com/resellers has a form. A business fills it in, it lands here as
-- 'pending', and Cardtly approves or declines it from Admin, Resellers.
-- Approving creates the reseller (migration 094) from these details and links
-- it back through reseller_id, so it is always clear which application a
-- reseller came from.
--
-- Service role only, like every reseller table: the form posts to a server
-- route, which validates it and writes it; the browser never touches this
-- table, so an anonymous visitor cannot read anybody else's application.

create table if not exists public.reseller_applications (
  id                   uuid primary key default gen_random_uuid(),
  status               text not null default 'pending' check (status in ('pending', 'approved', 'declined')),

  -- The business.
  trading_name         text not null,
  registered_name      text,
  registration_number  text,
  vat_number           text,
  business_type        text not null,
  website              text,
  address              text not null,
  city                 text not null,
  province             text not null,
  postal_code          text not null,

  -- Who to talk to.
  contact_name         text not null,
  contact_role         text,
  email                text not null,
  phone                text not null,

  -- What they plan.
  expected_clients     text not null,
  expected_seats       text,
  printing             text not null,
  pitch                text not null,
  heard_about          text,

  consented_at         timestamptz not null,

  -- The decision.
  reseller_id          uuid references public.resellers(id) on delete set null,
  decided_by           uuid,
  decided_at           timestamptz,
  decision_note        text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists reseller_applications_status_idx on public.reseller_applications(status, created_at desc);
create index if not exists reseller_applications_email_idx on public.reseller_applications(lower(email));
alter table public.reseller_applications enable row level security;
grant select, insert, update, delete on public.reseller_applications to service_role;

comment on table public.reseller_applications is
  'Applications from cardtly.com/resellers. Pending until approved (which creates a reseller) or declined in Admin, Resellers.';

-- Proof: the table, with RLS on.
select c.relname as table_name, c.relrowsecurity as rls_on
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'reseller_applications';
