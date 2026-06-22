-- Migration 016: questionnaire answers on contacts
--
-- The custom questionnaire add-on captures the standard fields (name,
-- email, phone, company, message - already columns on contacts) plus
-- up to 5 client-defined custom questions. The custom answers are
-- stored here as a self-describing list so a response stays readable
-- even if the client later edits their questions.
--
-- Shape: [ { "label": "Which service?", "value": "Roofing" }, ... ]
--
-- The questionnaire definition itself lives on cards.addons.questionnaire
-- (migration 015's addons column).

alter table public.contacts
  add column if not exists answers jsonb;

comment on column public.contacts.answers is
  'Custom questionnaire answers (label/value pairs) for source=questionnaire leads.';
