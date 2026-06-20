-- Migration 014: richer contact fields for the paper-card scanner
--
-- The contacts table only stored name/email/phone/message. The card
-- scanner captures a full business card (title, company, website,
-- address), and the "Add to phone" feature needs those fields too.
-- Adds them as nullable columns so existing rows and form-leads are
-- unaffected.

alter table public.contacts
  add column if not exists title   text,
  add column if not exists company text,
  add column if not exists website text,
  add column if not exists address text;

comment on column public.contacts.title   is 'Job title - populated for scanned paper cards.';
comment on column public.contacts.company is 'Company - populated for scanned paper cards.';
comment on column public.contacts.website is 'Website - populated for scanned paper cards.';
comment on column public.contacts.address is 'Postal address - populated for scanned paper cards.';
