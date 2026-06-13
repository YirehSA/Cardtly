-- Migration 013: make the contacts table fully support team cards
--
-- Leads (contact-form submissions AND booking requests) from a TEAM
-- card are stored with team_card_id set and card_id null. For that to
-- work the contacts table needs:
--   1. a team_card_id column (FK to team_cards), and
--   2. card_id to be nullable.
--
-- If either is missing, team-card lead inserts fail. The contact form
-- surfaces that as an error to the visitor; the booking route swallows
-- it, so the lead silently never reaches the dashboard. This migration
-- guarantees both so every lead - personal or team - lands in contacts.
--
-- Idempotent: safe to run even if the column/nullability is already
-- correct (e.g. it was added via the Supabase dashboard earlier).

-- 1. team_card_id column + FK + index
alter table public.contacts
  add column if not exists team_card_id uuid references public.team_cards(id) on delete cascade;

create index if not exists idx_contacts_team_card_id
  on public.contacts (team_card_id)
  where team_card_id is not null;

-- 2. card_id must allow null (team-card leads have no personal card_id)
alter table public.contacts
  alter column card_id drop not null;

comment on column public.contacts.team_card_id is
  'Set when the lead came from a team card. Mutually exclusive with card_id.';
