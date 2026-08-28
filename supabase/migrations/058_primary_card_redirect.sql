-- One person, one public card URL.
--
-- Signing up always creates a personal card. Joining a team later creates a
-- second card in team_cards. Nothing connected the two, so somebody who did
-- both ended up with two live URLs, two view counts and two separate piles of
-- leads, with nothing on screen saying the other existed.
--
-- Rather than delete one - which would destroy the leads it captured and break
-- whatever is printed on an NFC card - each card can now point at the other.
-- A card with redirect_to_slug set keeps all its data and stops being served
-- at its own address: /card/<that slug> forwards to the winner instead. The
-- choice is reversible and costs nothing either way.
--
-- Deliberately a slug rather than an id: the two cards live in different
-- tables, so a foreign key could only ever point at one of them, and the
-- public route resolves by slug anyway.

alter table cards
  add column if not exists redirect_to_slug text;

alter table team_cards
  add column if not exists redirect_to_slug text;

-- A card pointing at itself is an infinite redirect. The application always
-- clears the winner's column when it sets the loser's, but this is the kind of
-- mistake that must not be reachable from a bad request.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_no_self_redirect') then
    alter table cards add constraint cards_no_self_redirect
      check (redirect_to_slug is null or redirect_to_slug <> slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_cards_no_self_redirect') then
    alter table team_cards add constraint team_cards_no_self_redirect
      check (redirect_to_slug is null or redirect_to_slug <> slug);
  end if;
end $$;

-- The public route looks this up on every card open, so it is worth an index
-- only where it is set, which is almost never.
create index if not exists cards_redirect_to_slug_idx
  on cards (redirect_to_slug) where redirect_to_slug is not null;
create index if not exists team_cards_redirect_to_slug_idx
  on team_cards (redirect_to_slug) where redirect_to_slug is not null;

comment on column cards.redirect_to_slug is
  'When set, this card is not served at its own URL: /card/<slug> forwards to this slug instead. Used when one person holds both a personal and a team card and has chosen which one is public. The card keeps its leads and history.';
comment on column team_cards.redirect_to_slug is
  'When set, this card is not served at its own URL: /card/<slug> forwards to this slug instead. See cards.redirect_to_slug.';
