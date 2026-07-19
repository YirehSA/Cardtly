-- Migration 041: a grace period after a failed payment
--
-- A single declined charge used to take a public card offline the moment
-- Paystack sent invoice.payment_failed. The gate asks for status = 'active'
-- and past_due is not active, so an expired bank card or a momentary lack of
-- funds meant someone could hand out their NFC card that afternoon and have it
-- 404 - while Paystack was still quietly retrying the invoice and would very
-- likely have collected within a day or two.
--
-- This records when the account first went past_due so the card can keep
-- serving for a short window afterwards. Cleared on the next successful
-- charge, so a customer who pays, fails, and pays again gets a fresh window
-- rather than one that never reopens.
--
-- Deliberately its own column rather than reading updated_at: updated_at moves
-- on any write to the row, so an unrelated update would silently restart the
-- grace clock and a card could hang on well past the window.

alter table public.whop_subscriptions
  add column if not exists past_due_since timestamptz;

comment on column public.whop_subscriptions.past_due_since is
  'When this subscription first went past_due. The public card keeps serving for PAYMENT_GRACE_DAYS (lib/plan-server.ts) after this, then stops. Cleared on charge.success.';

-- Any row already sitting in past_due predates this column, so it has no start
-- time. Give it one now rather than leaving it NULL, which the grace check
-- would otherwise have to guess at.
update public.whop_subscriptions
   set past_due_since = coalesce(updated_at, now())
 where status = 'past_due'
   and past_due_since is null;
