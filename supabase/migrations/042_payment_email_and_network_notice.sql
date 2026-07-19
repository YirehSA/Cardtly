-- Migration 042: two things people were never told
--
-- 1. past_due_email_sent_at
--
-- A failed payment starts a seven-day countdown to the card going offline
-- (migration 041), and the only sign of it was a banner in the dashboard. The
-- person about to lose their card is exactly the one who might not log in that
-- week, so it needs an email.
--
-- Stamped per past-due episode rather than once per account, and cleared
-- alongside past_due_since on the next successful charge. A customer whose
-- card fails in March and again in September is two separate events and should
-- hear about both. That is also why this is not a row in trial_emails, whose
-- unique (user_id, kind) would have silently swallowed the second one.
--
-- 2. network_notice_seen_at
--
-- The Network lists everyone by default with an opt-out. A member who never
-- opens Settings would never learn the directory exists, which is a poor deal
-- and not what POPIA expects of a new processing purpose. This records that
-- the one-time notice was shown and acknowledged, so it is a fact in the
-- database rather than a flag in one browser's local storage.

alter table public.whop_subscriptions
  add column if not exists past_due_email_sent_at timestamptz;

comment on column public.whop_subscriptions.past_due_email_sent_at is
  'When the "payment failed" email was sent for the current past_due episode. Cleared with past_due_since on charge.success so a later failure sends again.';

alter table public.profiles
  add column if not exists network_notice_seen_at timestamptz;

comment on column public.profiles.network_notice_seen_at is
  'When this user acknowledged the one-time Cardtly Network listing notice. NULL means they have not seen it yet.';

-- Existing members have been listed since migration 036 without being told, so
-- they all still need the notice. Left NULL deliberately: no backfill.
