-- Migration 059: a team look can follow the card it came from
--
-- "Use this person's look" copied the brand fields once and stopped. Nothing
-- said so, so changing the card it was taken from did nothing, and the only way
-- to find out was to update an address, look at the card, and see the old one.
--
-- brand_source points at the card a look came from. Where it is set, the brand
-- is read from that card at render time instead of from the copy, so an edit to
-- it reaches every card that follows it. NULL keeps the old behaviour exactly:
-- a snapshot that never changes on its own.
--
-- The brand column stays, and stays written, for two reasons: it is what a
-- linked look falls back to if the source card is ever deleted, and it is what
-- unlinking freezes the look at.

alter table public.organizations
  add column if not exists brand_source jsonb;

alter table public.departments
  add column if not exists brand_source jsonb;

comment on column public.organizations.brand_source is
  'Card this look follows: {"table":"cards"|"team_cards","id":uuid}. NULL means the brand column is a fixed copy.';

comment on column public.departments.brand_source is
  'Card this look follows: {"table":"cards"|"team_cards","id":uuid}. NULL means the brand column is a fixed copy.';

-- Only the two shapes the resolver understands. Without this a typo in the
-- table name would be stored happily and then silently resolve to no source at
-- all, which looks exactly like never having linked it.
alter table public.organizations
  drop constraint if exists organizations_brand_source_shape;
alter table public.organizations
  add constraint organizations_brand_source_shape check (
    brand_source is null or (
      brand_source ? 'table' and brand_source ? 'id'
      and brand_source->>'table' in ('cards', 'team_cards')
    )
  );

alter table public.departments
  drop constraint if exists departments_brand_source_shape;
alter table public.departments
  add constraint departments_brand_source_shape check (
    brand_source is null or (
      brand_source ? 'table' and brand_source ? 'id'
      and brand_source->>'table' in ('cards', 'team_cards')
    )
  );
