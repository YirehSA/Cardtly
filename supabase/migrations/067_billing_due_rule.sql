-- Migration 067: the due-date rule the letterhead already promises
--
-- Cardtly's letterhead states two terms in plain English: a quote is valid for
-- 14 days, and an invoice is due on the last day of the month. 064 stored only
-- payment_terms_days, which can express "14 days from issue" and cannot express
-- "the last day of the month" at all - the gap between them is 3 days for an
-- invoice issued on the 17th and 17 days for one issued on the 1st.
--
-- So the rule itself is stored, not just the number.
--
--   end_of_month  the last day of the month the invoice was issued in. The
--                 default, because it is what the letterhead says.
--   days          payment_terms_days after issue. For a client who negotiated
--                 30-day terms.
--   on_issue      due the day it goes out. NFC card orders and anything else
--                 paid before it is fulfilled.
--
-- Subscriptions ignore all three: they fall due on the anniversary of signup,
-- which dueDateFor already works out, because a prepaid cycle is not a payment
-- term at all.

alter table public.billing_settings
  add column if not exists invoice_due_rule text not null default 'end_of_month';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_settings_due_rule_check') then
    alter table public.billing_settings
      add constraint billing_settings_due_rule_check
      check (invoice_due_rule in ('end_of_month', 'days', 'on_issue'));
  end if;
end $$;

comment on column public.billing_settings.invoice_due_rule is
  'Default due date for a non-subscription invoice: end_of_month (the letterhead default), days (payment_terms_days after issue) or on_issue. Subscriptions fall due on the signup anniversary regardless.';

-- The letterhead's other stated term. 064 hardcoded 14 days in
-- lib/billing-docs; storing it means changing the promise does not need a
-- deploy.
alter table public.billing_settings
  add column if not exists quote_valid_days integer not null default 14;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_settings_quote_valid_check') then
    alter table public.billing_settings
      add constraint billing_settings_quote_valid_check
      check (quote_valid_days between 1 and 365);
  end if;
end $$;
