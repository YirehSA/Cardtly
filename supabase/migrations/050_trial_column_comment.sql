-- 050: the column comment still said 60 days.
--
-- Cosmetic, but not pointless. SCHEMA.md is generated from the live database
-- and carries these comments through, so the stale one had "When the 60-day
-- trial ends" sitting next to a default of 7 days - and stale documentation in
-- this repo has cost real hours before, which is the whole reason the schema
-- dump exists.

comment on column public.profiles.trial_ends_at is
  'When this account''s trial ends. Past this date with no active subscription the public card 404s. Defaults to 7 days from signup (migration 049); a trial code sets 30 or 60 instead.';
