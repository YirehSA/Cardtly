-- The public reseller listing, cardtly.com/find-a-reseller (Andre,
-- 2026-11-16). Rules in lib/reseller-listing.
--
--   listed           the reseller's own choice to be shown. Off until they
--                    switch it on: what they type is public.
--   listing          what they typed: description, city, provinces, phone,
--                    email, website. Checked by cleanListing before saving.
--   listing_blocked  Cardtly took the listing down (admin or the programme
--                    manager). The reseller cannot switch it back on.
--
-- Shown only from Bronze (100 cards sold) and while the reseller is active.
-- No new table, so no new grants: resellers is closed to the browser (094)
-- and the public page reads it through the service role, picking out only the
-- listing fields.

alter table public.resellers
  add column if not exists listed boolean not null default false;

alter table public.resellers
  add column if not exists listing jsonb not null default '{}'::jsonb;

alter table public.resellers
  add column if not exists listing_blocked boolean not null default false;
