-- Sales reps, and which clients belong to them.
--
-- The deal: a rep covers their basic and petrol with the first N cards
-- (250 by default). Everything from 251 up earns R10 per card per month,
-- recurring for as long as that client keeps paying. It is a running count of
-- their CURRENT paying client base, not a cumulative tally of everything they
-- ever sold: if a client leaves, that card stops counting and the commission
-- with it.
--
-- target_cards and commission_rand live per rep rather than as constants,
-- because the next rep will be on a different package and nobody should have
-- to deploy code to hire someone.

create table if not exists public.reps (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text,
  phone           text,
  -- Cards they must hold before commission starts. Their basic + petrol.
  target_cards    integer not null default 250 check (target_cards >= 0),
  -- Rand per card per month above the target.
  commission_rand integer not null default 10 check (commission_rand >= 0),
  active          boolean not null default true,
  started_on      date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Attribution. A rep owns a CLIENT, and a client is either a person with a
-- personal card or an organization, so the link lives on both.
--
-- ON DELETE SET NULL, deliberately: removing a rep must never cascade into
-- deleting a customer's profile or a company's team. It just unassigns them.
alter table public.profiles
  add column if not exists rep_id uuid references public.reps(id) on delete set null;

alter table public.organizations
  add column if not exists rep_id uuid references public.reps(id) on delete set null;

-- The read path is always "everything belonging to this rep".
create index if not exists profiles_rep_id_idx on public.profiles (rep_id) where rep_id is not null;
create index if not exists organizations_rep_id_idx on public.organizations (rep_id) where rep_id is not null;

-- Written and read only by the admin API via the service-role key, which
-- bypasses RLS. No policies granted: a rep's targets and commission are not
-- something any end user should be able to read.
alter table public.reps enable row level security;

comment on table public.reps is
  'Sales reps. Commission is a running count of their CURRENT paying clients, not a cumulative total: (paying cards - target_cards) x commission_rand per month.';
comment on column public.profiles.rep_id is
  'Which rep signed this client. Only their clients count toward their target.';
comment on column public.organizations.rep_id is
  'Which rep signed this team. Seats billed count toward that rep''s target; comped teams count zero.';
