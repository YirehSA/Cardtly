-- Per-card control of the team questionnaire add-on.
--
-- The questionnaire is still built ONCE on the organization (so the
-- admin maintains a single form), but each team card can now be switched
-- off individually - so not every card has to show it.
--
-- Defaults to TRUE so existing behaviour is preserved (when the org's
-- questionnaire add-on is on, every card shows it). Admins opt specific
-- cards OUT from the Team Cards dashboard.

alter table public.team_cards
  add column if not exists use_team_questionnaire boolean not null default true;
