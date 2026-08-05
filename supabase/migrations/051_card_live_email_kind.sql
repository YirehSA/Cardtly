-- 051: let trial_emails record the "your card is live" welcome.
--
-- kind carries a check constraint listing every allowed value, so a new email
-- type is not just application code - the insert that CLAIMS the send is
-- rejected until the constraint knows about it, and no mail goes out.
--
-- The four existing values are carried over deliberately. trial_heads_up is not
-- in the original 026 list; it was added by 027 and has 24 rows behind it, so
-- recreating this constraint from the migration that first declared it would
-- have quietly broken the heads-up script. Read the live values before
-- rewriting a constraint, not the oldest migration that mentions it.

alter table public.trial_emails
  drop constraint if exists trial_emails_kind_check;

alter table public.trial_emails
  add constraint trial_emails_kind_check
  check (kind in ('trial_7d', 'trial_1d', 'trial_expired', 'trial_heads_up', 'card_live'));
