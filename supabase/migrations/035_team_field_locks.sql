-- Migration 035: choosable field locks for team cards
--
-- Until now a team card was either fully brand-managed (every brand field
-- locked, all at once, whenever use_team_brand was on) or fully open. There
-- was no way for a company to say "keep the logo and the website ours, but let
-- people set their own phone number".
--
-- Locks are stored as an array of GROUP ids ('logo', 'website', 'socials',
-- 'links', 'images', 'design', ...) rather than raw column names, so the
-- meaning survives a column being added to a group later. lib/team-locks.ts
-- maps a group to the columns it covers.
--
-- Both levels exist because both people exist: the org admin sets company-wide
-- rules, and a department head can add more for their own team. The resolved
-- set is the union - a department can tighten, never loosen.

alter table public.organizations
  add column if not exists locked_fields jsonb not null default '[]'::jsonb;

alter table public.departments
  add column if not exists locked_fields jsonb not null default '[]'::jsonb;

comment on column public.organizations.locked_fields is
  'Array of lock-group ids that team members may not edit on their own card. See lib/team-locks.ts.';

comment on column public.departments.locked_fields is
  'Additional lock-group ids for this department, unioned with the organisation''s. A department can tighten, never loosen.';

-- Close the back door.
--
-- A lock is only real if it cannot be walked around. The editor used to update
-- team_cards straight from the browser with the member's own session, which
-- meant a member could set any column by calling the table directly, whatever
-- the UI showed them. Every write to team_cards in the app now goes through the
-- service role (checked: /api/team/card/save, /api/team, /api/department,
-- /api/admin, account deletion - there are no user-client writes left), so the
-- authenticated role has no need for UPDATE on this table at all.
--
-- Without this the locks are advisory. With it they hold.
revoke update on public.team_cards from authenticated;
