-- Migration 017: org-level add-ons
--
-- Add-ons (contact exchange, questionnaire) for a team are configured
-- once on the organization and apply to every team card in it, rather
-- than per card. A team admin builds one questionnaire and it pulls
-- through to all their team cards.
--
-- Same shape as cards.addons:
--   { "contactExchange": true, "questionnaireEnabled": true,
--     "questionnaire": { title, questions: [...] } }

alter table public.organizations
  add column if not exists addons jsonb not null default '{}'::jsonb;

comment on column public.organizations.addons is
  'Org-level add-on flags/config that apply to every team card in the org.';
