-- Migration 020: team brand (org-level, live)
--
-- The shared brand for a team - logo, company, website, colours,
-- template, socials, links - lives once on the organization and is
-- merged over every team card at render time. Change it once and all
-- team cards update. Team members only edit their personal fields
-- (name, title, contact, photo, bio); brand fields come from here.
--
-- Stored as JSONB of card-shaped fields (company, company_logo_url,
-- website, color_theme, linkedin_url, link_1_*, image_*, etc). Empty
-- {} means "no team brand set" - cards then render their own fields
-- (backward compatible).

alter table public.organizations
  add column if not exists brand jsonb not null default '{}'::jsonb;

comment on column public.organizations.brand is
  'Shared team brand (card-shaped fields) merged over every team card at render. Empty = not set.';
