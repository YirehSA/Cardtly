-- Allow a fourth reminder kind: the one-off heads-up announcement.
--
-- 026 created trial_emails with a CHECK limited to the three scheduled
-- reminders. The heads-up telling existing free users that the trial has
-- started is a separate, one-time send, but it wants the same send-once
-- guarantee: if the send loop dies partway through 25 people, re-running it
-- must not email the first dozen a second time. Reusing trial_emails gives
-- that for free via unique (user_id, kind).
--
-- Postgres has no "add value to a CHECK", so the constraint is dropped and
-- recreated with the extra value. No data is touched: every existing row
-- still satisfies the new constraint, which is a strict superset of the old.

alter table public.trial_emails
  drop constraint if exists trial_emails_kind_check;

alter table public.trial_emails
  add constraint trial_emails_kind_check
  check (kind in ('trial_7d', 'trial_1d', 'trial_expired', 'trial_heads_up'));
