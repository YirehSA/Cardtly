-- Migration 045: a second phone number on a saved contact
--
-- The card scanner asked the model for "the primary phone number" and got
-- exactly one back, so a business card carrying both a switchboard and a mobile
-- lost one of them - usually the mobile, because the office line tends to be
-- printed first. The mobile is the number a salesperson actually wants.
--
-- The scanner now reads both, so a saved contact needs somewhere to put the
-- second one. Mirrors the cards table, where phone is the cell and work_phone is
-- the landline.
--
-- Nullable, so every existing contact is untouched and keeps whichever single
-- number it already had in phone.

alter table public.contacts
  add column if not exists work_phone text;

comment on column public.contacts.work_phone is
  'Office / landline number. phone holds the mobile, matching cards.phone and cards.work_phone.';
