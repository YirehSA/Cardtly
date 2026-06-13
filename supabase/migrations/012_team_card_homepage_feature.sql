-- Migration 012: team cards on the homepage showcase
--
-- Personal cards can opt into the rotating "Real cards, real people"
-- section on cardtly.com via cards.allow_homepage_feature. This adds
-- the same opt-in to team cards so a team member (or the org admin)
-- can choose to feature their team card too.
--
-- Default false: nothing is featured until explicitly opted in, same
-- as personal cards.

alter table public.team_cards
  add column if not exists allow_homepage_feature boolean not null default false;

-- Partial index for the homepage query (only the opted-in rows).
create index if not exists idx_team_cards_homepage_feature
  on public.team_cards (allow_homepage_feature)
  where allow_homepage_feature = true;

comment on column public.team_cards.allow_homepage_feature is
  'When true, this team card is eligible for the cardtly.com homepage showcase rotation.';
