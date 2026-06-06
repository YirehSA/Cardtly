-- ============================================================
-- Admin role flag.
--
-- Previously the admin check was hardcoded to a single user id
-- in 5 different files. This adds a per-profile is_admin flag
-- so the original founder admin + anyone else they promote can
-- both access /admin, /admin/promotions, and the admin APIs.
--
-- The hardcoded original-admin user id remains a fallback in the
-- isAdminUser() helper so we never accidentally lock ourselves
-- out if the row is deleted or the flag flipped off.
-- ============================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Has access to /admin and admin APIs. Toggled from /admin Users tab.';

-- Partial index — admin checks read this column constantly via
-- the helper, but most rows are false so a partial keeps it tiny.
create index if not exists idx_profiles_is_admin
  on public.profiles(user_id)
  where is_admin = true;
