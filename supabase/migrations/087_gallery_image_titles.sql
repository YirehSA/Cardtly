-- Migration 087: a gallery photo can say what it is.
--
-- WHY. The gallery renders a photo and an optional link and nothing else, so
-- it can show a picture of a car but not "2021 Ranger Wildtrak - 64,000 km -
-- R589,000". For the Showroom template that is the whole point: a listing
-- without a price is a worse listing than a plain text link, and a dealership
-- card exists to move metal.
--
-- WHAT IS ALREADY THERE, AND WHY IT IS NOT ENOUGH.
--
--   cards        image_1_title .. image_5_title exist. Slots 6 to 10 do not,
--                so the same gallery is captionable for half its length.
--   team_cards   no image title columns at all, and no link_N_image_url
--                either - so on a team card there is NO way to pair a photo
--                with text, through the gallery or through the links.
--
-- That second line is the one that matters. A dealership is a team-card case
-- almost by definition: a group, a locked brand, and forty salespeople who
-- each get a card. Building the rail only for personal cards would ship the
-- feature to the customers least likely to want it.
--
-- Additive, nullable, no backfill, no existing value touched. Every card in
-- the database reads exactly as it does today until somebody types a caption.
--
-- THIS IS A PLATFORM CHANGE, NOT A DEALERSHIP ONE. The gallery is shared by
-- all sixteen templates, so captions become available everywhere. That is
-- intended rather than a side effect, but it is worth saying out loud: the
-- next person to wonder why Frost has image captions will find the answer
-- here.

alter table public.team_cards
  add column if not exists image_1_title  text,
  add column if not exists image_2_title  text,
  add column if not exists image_3_title  text,
  add column if not exists image_4_title  text,
  add column if not exists image_5_title  text,
  add column if not exists image_6_title  text,
  add column if not exists image_7_title  text,
  add column if not exists image_8_title  text,
  add column if not exists image_9_title  text,
  add column if not exists image_10_title text;

alter table public.cards
  add column if not exists image_6_title  text,
  add column if not exists image_7_title  text,
  add column if not exists image_8_title  text,
  add column if not exists image_9_title  text,
  add column if not exists image_10_title text;

-- ── The part that is easy to miss ───────────────────────────────────────────
--
-- Migration 084 revoked UPDATE on cards from the authenticated role and granted
-- it back as an EXPLICIT LIST of columns, computed from the catalogue at the
-- moment it ran. A column added afterwards is therefore not in that grant, and
-- the card editor - which writes the gallery fields straight from the browser
-- with the user's own session - would fail on it with
--
--     permission denied for column image_6_title
--
-- 084's own table comment says exactly this would happen. So the five new
-- columns on cards have to be granted, or the first person to caption their
-- sixth photo cannot save their card.
--
-- image_1_title through image_5_title need nothing: they existed when 084 ran
-- and are already inside its grant.
--
-- team_cards needs no grant at all. Migration 085 revoked every write on it
-- from both anon and authenticated, and team card saves go through
-- /api/team/card/save with the service role, which these grants do not govern.

grant update (
  image_6_title, image_7_title, image_8_title, image_9_title, image_10_title
) on public.cards to authenticated;

comment on column public.cards.image_6_title is
  'Caption under a gallery photo. Added by migration 087 for the Showroom template, where the gallery is a list of vehicles rather than a set of pictures, but available to every template.';

comment on column public.team_cards.image_1_title is
  'Caption under a gallery photo. Added by migration 087. team_cards had no image title column at all, which is why a team card could not show a photo with a price under it.';

-- Proof 1. Expected: ten rows for team_cards, ten for cards, all text and
-- nullable.
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and column_name like 'image%_title'
   and table_name in ('cards', 'team_cards')
 order by table_name, length(column_name), column_name;

-- Proof 2. The card editor can write every one of them. Expected: 10 rows,
-- image_1_title through image_10_title.
select column_name
  from information_schema.column_privileges
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name = 'cards'
   and privilege_type = 'UPDATE'
   and column_name like 'image%_title'
 order by length(column_name), column_name;
