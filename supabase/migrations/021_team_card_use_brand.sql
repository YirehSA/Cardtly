-- Migration 021: per-card team-brand opt-in
--
-- The team brand must be applied PER MEMBER, not to every card. Some
-- team cards (e.g. a family member or contractor with their own
-- company) should keep their own branding. This adds a per-card flag;
-- the brand only merges over cards where it's true.
--
-- Default false so applying a team brand never silently overrides a
-- card again - the admin opts each card in. Existing cards become
-- false, immediately reverting them to their own (untouched) branding.
-- (The brand was only ever a render-time overlay, so no card data was
-- lost.)

alter table public.team_cards
  add column if not exists use_team_brand boolean not null default false;

comment on column public.team_cards.use_team_brand is
  'When true, the org team brand is merged over this card at render. Admin opts each card in.';
