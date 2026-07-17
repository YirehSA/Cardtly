-- Departments inside a team, each with its own look and its own managers.
--
-- The model so far is single-level: one organization, one admin_user_id, one
-- brand. A big company with five departments, each wanting its own look and
-- its own manager, has nowhere to put any of that.
--
-- This is the foundation layer: the tables and the brand cascade. The admin
-- setup UI and the manager self-serve dashboard build on top of it in later
-- migrations, so this one deliberately changes no behaviour on its own beyond
-- letting a card belong to a department and wear that department's brand.
--
-- Brand cascade, decided here: department brand > org brand > the card's own.
-- A department only overrides what it wants to differ (colours, logo), and
-- inherits everything else from the org, so setting up a department is light.

create table if not exists public.departments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  -- Same shape as organizations.brand: a map of brand fields (see
  -- lib/team-brand BRAND_FIELDS). Empty means "inherit the org brand whole".
  brand           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists departments_org_idx on public.departments (organization_id);

-- Who manages a department. A join table, not a single manager_user_id,
-- because a department can have a backup and a manager can run more than one.
--
-- Being a manager is what grants scoped access later: they manage only the
-- departments they are in, invite only into those, and edit only those brands.
create table if not exists public.department_managers (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (department_id, user_id)
);

create index if not exists department_managers_user_idx on public.department_managers (user_id);
create index if not exists department_managers_dept_idx on public.department_managers (department_id);

-- Which department a card belongs to. ON DELETE SET NULL, so deleting a
-- department never deletes anyone's card: the card falls back to the org brand,
-- exactly as if it had never been in a department.
alter table public.team_cards
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists team_cards_department_idx
  on public.team_cards (department_id) where department_id is not null;

-- Service-role only, like the rest of the org tables. Scoped reads for
-- managers happen through the app with the service-role key after an explicit
-- permission check, not through RLS, matching how organizations already works.
alter table public.departments enable row level security;
alter table public.department_managers enable row level security;

comment on table public.departments is
  'A department inside an organization, with its own brand. Card brand cascades department > org > own.';
comment on table public.department_managers is
  'Who manages a department. Grants scoped access: manage only these departments, invite only into them, edit only their brand.';
comment on column public.team_cards.department_id is
  'Which department this card belongs to. NULL means the org level. ON DELETE SET NULL so deleting a department never deletes a card.';
