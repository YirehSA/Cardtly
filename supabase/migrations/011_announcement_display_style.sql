-- Migration 011: announcement display style
--
-- The site-wide announcement (app_announcements) has always rendered
-- as a thin dismissible banner at the top of the dashboard. This adds
-- a display_style so the same announcement can instead be shown as a
-- big centered popup/modal that demands attention - for important
-- broadcasts (new features, downtime, promos) the banner is easy to
-- scroll past.
--
--   'banner' - the original top-of-dashboard strip (default)
--   'modal'  - full-screen dimmed overlay with a large card
--
-- Existing rows default to 'banner' so nothing changes for current
-- announcements.

alter table public.app_announcements
  add column if not exists display_style text not null default 'banner';

-- Guard the allowed values. Drop-then-add so re-running the migration
-- doesn't fail on an existing constraint.
alter table public.app_announcements
  drop constraint if exists app_announcements_display_style_check;
alter table public.app_announcements
  add constraint app_announcements_display_style_check
  check (display_style in ('banner', 'modal'));

comment on column public.app_announcements.display_style is
  'How the announcement renders: banner (thin top strip) or modal (big centered popup).';
