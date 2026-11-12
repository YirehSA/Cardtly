-- Migration 106: NFC orders paid inside the Pro year + card bundle (R999)
--
-- A bundle payment is completed twice, by design: once when the customer comes
-- back from Paystack (/upgrade/verify) and once by the Paystack webhook, often
-- in the same second. The order row is written only when the money has
-- arrived, and this unique reference is what lets exactly one of the two
-- write it. The second gets a unique violation (23505) and knows the work is
-- done. Without it a single payment could print two cards.
--
-- bundle marks the order as already paid for, so nobody sends it an invoice.
--
-- nfc_orders has RLS on with no policies (migration 079): only the service
-- role reads or writes it, so no grants are needed for the new columns.
--
-- The checkout refuses to start until this has run (lib/pro-bundle-server).

alter table public.nfc_orders add column if not exists paystack_reference text;
alter table public.nfc_orders add column if not exists bundle boolean not null default false;

create unique index if not exists nfc_orders_paystack_reference_key
  on public.nfc_orders (paystack_reference)
  where paystack_reference is not null;
