-- Migration 062: an email address on a logged call
--
-- Separate from 061 rather than edited into it, because 061 has already been
-- run. Editing an applied migration means the file no longer describes the
-- database anybody actually has.
--
-- Optional, like the name and the number. Getting an address out of a cold call
-- is the good outcome, not the requirement, and a rep who could not must still
-- be able to log the call.

alter table public.rep_calls
  add column if not exists email text;

comment on column public.rep_calls.email is
  'Address taken during the call, if they gave one. Optional.';
