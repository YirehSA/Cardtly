-- Migration 083: a user may edit their own name, not their own privileges.
--
-- THE HOLE. profiles carries three RLS policies, created in the dashboard:
-- users can select, insert and update their own row. That is the right shape
-- for a profile table and it is not what it sounds like, because POSTGRES RLS
-- IS ROW LEVEL, NOT COLUMN LEVEL. A policy that lets somebody update their own
-- row lets them update every column of it, and Supabase grants the
-- authenticated role UPDATE on every column of every public table by default.
-- Exactly one REVOKE exists in the 82 migrations before this one - 035, for
-- team_cards - so profiles still carries that default.
--
-- What that means in practice, for anybody with an account and the anon key
-- that ships in the page:
--
--   is_admin             true grants /admin. lib/admin-check.ts returns admin
--                        for the founder id OR any profile flagged is_admin,
--                        so this is the whole panel: every customer, billing,
--                        trial codes, account deletion.
--   trial_ends_at        a date in 2099 is permanent free Pro. The signup
--                        insert deliberately omits it so the browser cannot
--                        choose the trial length - but omitting a field is not
--                        the same as being unable to send it.
--   is_founder,
--   founder_lifetime_pro forever-Pro and the founder badge.
--   rep_id               attribute yourself to a rep, and to their commission.
--
-- 035 wrote the argument for this better than I can: "A lock is only real if it
-- cannot be walked around." Same table shape, same fix, one table over.
--
-- WHAT THE BROWSER ACTUALLY NEEDS. Every write to profiles in the app was
-- checked, and only three run with the user's own session:
--
--   app/signup/page.tsx          insert { user_id, name }
--   components/settings/...      update { name, updated_at }
--   app/api/network/notice       update { network_notice_seen_at }
--
-- Everything else - the trial, the admin flag, founder status, rep attribution,
-- heartbeat, signup tracking - already goes through the service role. So the
-- authenticated role needs four columns and no more.
--
-- The trial still works: trial_ends_at is filled by its column default
-- (migration 049, now() + 7 days) when the row is inserted without it, and a
-- default fires whether or not the inserting role may write that column.

revoke insert, update on public.profiles from authenticated;

grant insert (user_id, name) on public.profiles to authenticated;
grant update (name, updated_at, network_notice_seen_at) on public.profiles to authenticated;

comment on table public.profiles is
  'One row per user. RLS lets somebody read and edit their OWN row, and the column grants decide which parts: name, updated_at and network_notice_seen_at. Everything that confers privilege - trial_ends_at, is_admin, is_founder, founder_lifetime_pro, rep_id - is writable only by the service role. Before migration 083 an account holder could set any of them on themselves.';

-- Proof, in the result pane. authenticated must hold UPDATE on exactly
-- name, updated_at and network_notice_seen_at, and INSERT on user_id and name.
select privilege_type, string_agg(column_name, ', ' order by column_name) as columns
  from information_schema.column_privileges
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name = 'profiles'
   and privilege_type in ('INSERT', 'UPDATE')
 group by privilege_type
 order by privilege_type;
