-- ============================================================
-- Homepage feature opt-in.
--
-- Lets users explicitly consent to having their card featured
-- in the rotating "Real cards, real people" section on the
-- public Cardtly homepage. Defaults to false so existing users
-- and new signups are not opted in automatically (POPIA-safe).
-- ============================================================

alter table public.cards
  add column if not exists allow_homepage_feature boolean not null default false;

-- Partial index — we only ever query for the opted-in rows, so a
-- partial index keeps it tiny and fast.
create index if not exists idx_cards_homepage_feature
  on public.cards(allow_homepage_feature)
  where allow_homepage_feature = true;

comment on column public.cards.allow_homepage_feature is
  'User opted in to having this card featured in the rotating showcase on cardtly.com. Default false; toggled per-card from /dashboard/settings.';
