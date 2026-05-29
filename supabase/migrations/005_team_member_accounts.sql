-- ============================================================
-- Team member accounts.
--
-- Lets each team card be claimed by a real auth.users account so
-- team members (not just the org admin) can sign in to the app,
-- share their card via NFC/QR/link, save contacts that came in
-- through their card, etc.
--
-- The admin still owns the organization and controls brand-level
-- fields (company, logo, template, colours) via API-level gates.
-- Members get to edit their own personal info on their card.
--
-- Flow:
--   1. Admin issues an invite from /dashboard/team for a card.
--      We set invite_email + invite_token + invite_sent_at.
--   2. Invitee opens the email, clicks the link to
--      /team/claim/{token}, sets a password.
--   3. We create an auth.users record (or sign in if they already
--      have one), then UPDATE the team_card setting user_id and
--      claimed_at. invite_token is nulled so it can't be reused.
-- ============================================================

alter table public.team_cards
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists invite_email text,
  add column if not exists invite_token text,
  add column if not exists invite_sent_at timestamptz,
  add column if not exists claimed_at timestamptz;

-- Lookup by user_id when a member signs in — used by the dashboard
-- to find their team card.
create index if not exists idx_team_cards_user_id
  on public.team_cards(user_id)
  where user_id is not null;

-- Unique invite_token so /team/claim/{token} can find exactly one
-- card. Partial because most rows will have NULL once claimed.
create unique index if not exists idx_team_cards_invite_token
  on public.team_cards(invite_token)
  where invite_token is not null;

comment on column public.team_cards.user_id is
  'The auth.users id of the team member who claimed this card. NULL = unclaimed (admin-only).';
comment on column public.team_cards.invite_token is
  'Random token used in the claim URL. Cleared once claimed_at is set.';
