-- Migration 009: team_cards.view_count
--
-- Adds a denormalized view counter to team_cards so admin and
-- dashboards can show traffic per team card the same way they
-- already do for personal cards.
--
-- The matching app-side change is in app/api/analytics/route.ts -
-- when the analytics POST body includes team_card_id, that route
-- bumps this column directly. We deliberately don't add a trigger
-- here because the existing cards.view_count increment lives
-- in a Supabase-dashboard trigger we don't want to risk shadowing.

alter table public.team_cards
  add column if not exists view_count integer not null default 0;

create index if not exists idx_team_cards_view_count
  on public.team_cards (view_count desc nulls last);

comment on column public.team_cards.view_count is
  'Total public views. Incremented by /api/analytics when team_card_id is provided.';
