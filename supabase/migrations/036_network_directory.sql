-- Migration 036: the Cardtly Network directory
--
-- A searchable directory of cards inside the dashboard: find a company, see the
-- people who work there, open their card.
--
-- Two new pieces of data:
--
-- 1. industry. Nothing on a card recorded what line of work someone is in, so
--    "search by niche" had nothing to search. It is a short fixed list rather
--    than free text, so that "Real Estate", "realtor" and "property" do not end
--    up as three separate niches. The list lives in lib/industries.ts.
--
-- 2. hide_from_network. Cards are listed by default and the owner can switch
--    themselves off. The directory is behind dashboard auth and never shows a
--    phone number or email address in the listing - you get name, position,
--    company and photo, all of which are already on the public card - so what
--    is new here is discoverability, not exposure of anything private.

alter table public.cards
  add column if not exists industry text,
  add column if not exists hide_from_network boolean not null default false;

alter table public.team_cards
  add column if not exists industry text,
  add column if not exists hide_from_network boolean not null default false;

comment on column public.cards.industry is
  'Fixed-list industry id from lib/industries.ts. Powers the Network directory filter.';
comment on column public.cards.hide_from_network is
  'When true the card is not listed in the Cardtly Network directory. Owner controlled.';
comment on column public.team_cards.industry is
  'Fixed-list industry id from lib/industries.ts.';
comment on column public.team_cards.hide_from_network is
  'When true the card is not listed in the Cardtly Network directory.';

-- The directory groups by company and filters by industry, and it only ever
-- looks at listable cards. These indexes cover both queries.
create index if not exists cards_network_idx
  on public.cards (industry, company)
  where hide_from_network = false and slug is not null;

create index if not exists team_cards_network_idx
  on public.team_cards (industry, company)
  where hide_from_network = false and slug is not null and is_active = true;
