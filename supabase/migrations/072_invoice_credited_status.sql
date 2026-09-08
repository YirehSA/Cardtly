-- Migration 072: an invoice settled by a credit note is not a paid invoice
--
-- 064 gave invoices draft, issued, sent, part_paid, paid, overdue, cancelled
-- and written_off. A fully credited invoice is none of those:
--
--   paid        would make the money look collected in every report that
--               counts paid invoices, and no money was received
--   cancelled   is for something voided before it went out; this one was
--               issued, sent, and is on the books
--   written_off is giving up on a debt that is still owed; a credited invoice
--               is not owed at all
--
-- So it gets its own value. The distinction is the difference between "we
-- collected R5 616" and "we agreed they did not have to pay it", which is
-- exactly the question a year-end asks.

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft','issued','sent','part_paid','paid','overdue','cancelled','written_off','credited'));

comment on column public.invoices.status is
  'draft -> issued -> sent -> part_paid/paid. credited means credit notes cover the balance and no money was received; written_off means it is still owed and we have given up. Neither is paid.';

create index if not exists credit_notes_invoice_idx on public.credit_notes(invoice_id);
