-- Migration 060: ten links, ten photos, TikTok and YouTube, and the team brand
-- on by default
--
-- cards already carries link_1..link_20 and youtube/tiktok - columns added long
-- ago and never used by anything, verified empty across every row. team_cards
-- has none of them, and BRAND_FIELDS depends on both tables having identically
-- named columns, so the gap is filled here rather than inventing new names.
--
-- The existing youtube/tiktok spelling is kept deliberately, over the tidier
-- youtube_url/tiktok_url: adding those would leave two near-identical columns
-- on cards, and the next person to touch this would have to work out which one
-- the app actually reads.

-- ── Socials: TikTok and YouTube ───────────────────────────────────────────
alter table public.team_cards add column if not exists youtube text;
alter table public.team_cards add column if not exists tiktok  text;

comment on column public.cards.youtube is 'Full URL to a YouTube channel or profile.';
comment on column public.cards.tiktok  is 'Full URL to a TikTok profile.';
comment on column public.team_cards.youtube is 'Full URL to a YouTube channel or profile.';
comment on column public.team_cards.tiktok  is 'Full URL to a TikTok profile.';

-- ── Link buttons 6 to 10 on team cards ────────────────────────────────────
-- cards already has these and more.
alter table public.team_cards add column if not exists link_6_title  text;
alter table public.team_cards add column if not exists link_6_url    text;
alter table public.team_cards add column if not exists link_7_title  text;
alter table public.team_cards add column if not exists link_7_url    text;
alter table public.team_cards add column if not exists link_8_title  text;
alter table public.team_cards add column if not exists link_8_url    text;
alter table public.team_cards add column if not exists link_9_title  text;
alter table public.team_cards add column if not exists link_9_url    text;
alter table public.team_cards add column if not exists link_10_title text;
alter table public.team_cards add column if not exists link_10_url   text;

-- ── Gallery photos 7 to 10, on both ───────────────────────────────────────
alter table public.cards      add column if not exists image_7_url   text;
alter table public.cards      add column if not exists image_7_link  text;
alter table public.cards      add column if not exists image_8_url   text;
alter table public.cards      add column if not exists image_8_link  text;
alter table public.cards      add column if not exists image_9_url   text;
alter table public.cards      add column if not exists image_9_link  text;
alter table public.cards      add column if not exists image_10_url  text;
alter table public.cards      add column if not exists image_10_link text;

alter table public.team_cards add column if not exists image_7_url   text;
alter table public.team_cards add column if not exists image_7_link  text;
alter table public.team_cards add column if not exists image_8_url   text;
alter table public.team_cards add column if not exists image_8_link  text;
alter table public.team_cards add column if not exists image_9_url   text;
alter table public.team_cards add column if not exists image_9_link  text;
alter table public.team_cards add column if not exists image_10_url  text;
alter table public.team_cards add column if not exists image_10_link text;

-- ── The team brand starts on ──────────────────────────────────────────────
-- A company that has set a look wants its people wearing it; having to switch
-- that on card by card is a step nobody knew to take, so cards were quietly
-- being handed out in default blue. Off is still one toggle away for the
-- contractor or the family member who keeps their own branding.
--
-- Only the DEFAULT changes. Every existing card keeps the setting it has, so
-- nothing already published changes appearance because of this migration.
alter table public.team_cards
  alter column use_team_brand set default true;

comment on column public.team_cards.use_team_brand is
  'Wear the company look. On by default since migration 060; turn off for anyone who keeps their own branding.';
