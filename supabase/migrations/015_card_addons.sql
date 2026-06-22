-- Migration 015: per-card add-ons
--
-- Paid add-ons enabled for individual clients (not everyone). An
-- admin flips these on per card from the admin panel. Stored as a
-- JSONB blob so we can add future add-ons without new columns.
--
-- Shape: { "contactExchange": true, "questionnaire": { ...form def... } }
--   contactExchange - after a visitor saves the card, prompt them to
--                     share their own details back (reciprocal capture).
--   questionnaire   - a custom form (built later) shown on the card.

alter table public.cards
  add column if not exists addons jsonb not null default '{}'::jsonb;

alter table public.team_cards
  add column if not exists addons jsonb not null default '{}'::jsonb;

comment on column public.cards.addons is
  'Per-card paid add-on flags/config, enabled by an admin. e.g. { contactExchange: true }.';
comment on column public.team_cards.addons is
  'Per-card paid add-on flags/config, enabled by an admin.';
