-- Sign-up chooses a plan (Andre, 2026-11-20). With Cardtly Solo, a new
-- account no longer starts a trial by itself: people choose Solo or Pro and
-- pay, and the 7-day trial is only offered, quietly, to somebody who will not
-- choose. That trial is Solo, not Pro.
--
--   profiles.trial_tier   what the account's trial gives:
--                           null    an account from before this: its trial,
--                                   if any, is Pro, exactly as before
--                           'none'  a new account that has not taken a
--                                   trial: nothing is live until it chooses
--                           'solo'  took the 7-day Solo trial
--                           'pro'   a Pro trial (a rep's trial code)
--
-- NEW ACCOUNTS ONLY. Every existing row keeps trial_tier null and its
-- trial_ends_at, so no running trial changes. From now on a new row gets
-- trial_tier 'none' and trial_ends_at = now(), so nothing reads it as a trial
-- that is still running. Starting the Solo trial (lib/signup-trial) sets both.
--
-- Not writable by the signed-in user: migration 083 grants profile updates
-- column by column, and this column is not among them. Only the server sets it.
--
-- Also lets the reminder cron record its new "choose a plan" email.

alter table public.profiles
  add column if not exists trial_tier text
  check (trial_tier in ('none', 'solo', 'pro'));

alter table public.profiles alter column trial_tier set default 'none';
alter table public.profiles alter column trial_ends_at set default now();

alter table public.trial_emails
  drop constraint if exists trial_emails_kind_check;

alter table public.trial_emails
  add constraint trial_emails_kind_check
  check (kind in ('trial_7d', 'trial_1d', 'trial_expired', 'trial_heads_up', 'card_live', 'choose_plan'));
