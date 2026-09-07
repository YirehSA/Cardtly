-- Migration 065: two fields the letterhead has and the schema did not
--
-- Reading Cardtly's actual letterhead turned up two things every invoice
-- carries and 064 had no column for.
--
-- website: it is in the letterhead header next to the phone number and the
-- email address, and a document that lists two of the three looks truncated.
--
-- bank_account_type: a South African EFT beneficiary is set up with bank,
-- account name, account number, branch code AND account type. Leaving it off
-- an invoice means the payer has to guess or ask, and a cheque-versus-savings
-- mistake bounces the payment rather than misrouting it.

alter table public.billing_settings
  add column if not exists website           text,
  add column if not exists bank_account_type text;

comment on column public.billing_settings.bank_account_type is
  'Cheque/Current, Savings or Transmission. Part of a South African EFT beneficiary setup, so it belongs on the invoice.';
