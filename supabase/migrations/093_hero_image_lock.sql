-- The hero image gets its own lock.
--
-- The big photo across the top of a Showroom card was locked as part of the
-- gallery ('images' in lib/team-locks). Companies differ on it: some want one
-- forecourt shot across the top of every card, others want each seller's own,
-- and both may still want the gallery fixed. So it is now its own lock group,
-- 'hero'.
--
-- Everyone who locked the gallery before this locked the hero with it. Adding
-- 'hero' to exactly those keeps every card showing and allowing what it did
-- the day before; each company or team can then unlock the hero on its own.
--
-- Safe to run before or after the code that knows 'hero': the code before it
-- drops lock ids it does not recognise. Run it BEFORE that code deploys, so
-- there is no window in which those hero images are unlocked. Idempotent.

update public.organizations
   set locked_fields = locked_fields || '["hero"]'::jsonb
 where locked_fields ? 'images'
   and not (locked_fields ? 'hero');

update public.departments
   set locked_fields = locked_fields || '["hero"]'::jsonb
 where locked_fields ? 'images'
   and not (locked_fields ? 'hero');

-- Check: every row that locks the gallery also locks the hero. Expect 0, 0.
select
  (select count(*) from public.organizations where locked_fields ? 'images' and not (locked_fields ? 'hero')) as orgs_missing_hero,
  (select count(*) from public.departments   where locked_fields ? 'images' and not (locked_fields ? 'hero')) as departments_missing_hero;
