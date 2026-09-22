-- Migration 088: the hero photo is its own field, not gallery slot 1.
--
-- WHAT IT REPLACES. Showroom shipped yesterday using image_1_url as the big
-- photo across the top of the card, and deliberately so: migration 087's
-- sibling comment in PublicCardView argued that "your first photo is the big
-- one" was a rule a salesperson could hold in their head, and that one gallery
-- to fill in beat two places to forget.
--
-- WHY THAT WAS WRONG. It quietly costs the dealership a listing. The gallery
-- is ten slots, and spending one of them on a photo that is already filling
-- the top of the card leaves nine vehicles in the stock grid, not ten. Worse,
-- the two photos want different things: the hero is atmosphere - the forecourt,
-- the flagship, the building - and a gallery entry is a specific car with a
-- price under it. Forcing one image to be both means either the hero is a
-- listing that repeats itself six inches lower, or the first listing is a wide
-- establishing shot with a price on it.
--
-- So: hero_image_url, separate, and the gallery goes back to ten.
--
-- FALLING BACK TO image_1_url. The card reads hero_image_url first and uses
-- image_1_url when it is empty. That is not indecision, it is the upgrade
-- path: every Showroom card that exists today has its hero in slot 1, and a
-- card switching to Showroom for the first time gets a hero straight away
-- instead of an accent-coloured rectangle. Fill the new field in and the
-- duplicate goes away.
--
-- ONE TEMPLATE, TWO TABLES. team_cards gets it for the same reason 087 did: a
-- dealership is a team-card case almost by definition - one brand, one
-- forecourt, forty salespeople - so the personal table alone would ship the
-- feature to the customers least likely to want it.
--
-- Additive, nullable, no backfill. Every card in the database renders exactly
-- as it does today.

alter table public.cards
  add column if not exists hero_image_url text;

alter table public.team_cards
  add column if not exists hero_image_url text;

-- ── The grant, for the same reason 087 needed one ───────────────────────────
--
-- Migration 084 revoked UPDATE on cards from the authenticated role and granted
-- it back as an EXPLICIT LIST of columns, computed from the catalogue at the
-- moment it ran. Any column added afterwards is outside that grant, and the
-- card editor writes straight from the browser with the user's own session, so
-- without this the first dealer to upload a hero would be told
--
--     permission denied for column hero_image_url
--
-- team_cards needs no grant: 085 revoked every write on it from both roles, and
-- team card saves go through /api/team/card/save with the service role, which
-- these grants do not govern.

grant update (hero_image_url) on public.cards to authenticated;

comment on column public.cards.hero_image_url is
  'The full-bleed photo across the top of a Showroom card. Added by migration 088 to stop the hero consuming a gallery slot. Falls back to image_1_url when empty, which is how cards built before 088 keep their hero. Ignored by the other fifteen templates.';

comment on column public.team_cards.hero_image_url is
  'The full-bleed photo across the top of a Showroom card. Added by migration 088. Part of the team brand and locked with the gallery, so a group that fixes its photos fixes its forecourt shot too.';

-- Proof 1. Expected: two rows, cards and team_cards, both text and nullable.
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and column_name = 'hero_image_url'
   and table_name in ('cards', 'team_cards')
 order by table_name;

-- Proof 2. The card editor can write it. Expected: exactly one row.
select column_name, privilege_type
  from information_schema.column_privileges
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name = 'cards'
   and column_name = 'hero_image_url';

-- Proof 3. The gallery is untouched and still ten wide on both tables.
-- Expected: 10 and 10.
select table_name, count(*) as gallery_slots
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('cards', 'team_cards')
   and column_name ~ '^image_[0-9]+_url$'
 group by table_name
 order by table_name;
