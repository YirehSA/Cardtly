-- Migration 068: money in, then money allocated
--
-- 064 modelled a payment as "an amount against one invoice". That can express
-- the easy case and not the two that actually happen:
--
--   A client EFTs R10,000 covering three invoices. Under 064 that is three
--   payment rows that only a human knows were one bank line, so it cannot be
--   reconciled against a statement.
--
--   A client EFTs R10,000 with no reference and nobody yet knows which
--   invoices it settles. Under 064 the money cannot be recorded at all until
--   somebody guesses, and a guess in the books is worse than a gap.
--
-- So the two halves are separated, which is what "load payments and allocate
-- payments" actually means:
--
--   billing_receipts  the money that arrived. One row per bank line.
--   billing_payments  an allocation of some of a receipt to one invoice.
--
-- A receipt with nothing allocated is unapplied cash sitting on the account,
-- which is a real and normal state. The difference between the receipt and its
-- allocations is what still needs a home.

create table if not exists public.billing_receipts (
  id           uuid primary key default gen_random_uuid(),
  -- Nullable on purpose. An unidentified deposit is still money that arrived,
  -- and refusing to record it until somebody works out whose it is means the
  -- bank balance and the books disagree in the meantime.
  client_id    uuid references public.billing_clients(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  received_on  date not null default current_date,
  method       text not null default 'eft' check (method in ('eft','paystack','cash','card','other')),
  -- What appeared on the bank statement. The thing you search for when a
  -- client asks "did you get my payment".
  reference    text,
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists billing_receipts_client_idx on public.billing_receipts(client_id, received_on desc);
create index if not exists billing_receipts_date_idx on public.billing_receipts(received_on desc);

-- An allocation now belongs to a receipt. Nullable, because a payment can also
-- be recorded straight onto an invoice - a Paystack collection has no bank line
-- for anybody to load.
alter table public.billing_payments
  add column if not exists receipt_id uuid references public.billing_receipts(id) on delete cascade;
create index if not exists billing_payments_receipt_idx on public.billing_payments(receipt_id);

-- ── A receipt cannot give away more than it received ──────────────────────
create or replace function public.check_receipt_not_overallocated()
returns trigger
language plpgsql
as $$
declare
  v_receipt integer;
  v_allocated integer;
begin
  if NEW.receipt_id is null then
    return NEW;
  end if;

  select amount_cents into v_receipt
    from public.billing_receipts where id = NEW.receipt_id
    for update;   -- serialises two allocations racing against the same receipt

  select coalesce(sum(amount_cents), 0) into v_allocated
    from public.billing_payments
    where receipt_id = NEW.receipt_id
      and id is distinct from NEW.id;

  if v_allocated + NEW.amount_cents > v_receipt then
    raise exception
      'Allocating % would exceed the receipt. Received %, already allocated %, unallocated %.',
      NEW.amount_cents, v_receipt, v_allocated, v_receipt - v_allocated;
  end if;

  return NEW;
end;
$$;

drop trigger if exists billing_payments_not_overallocated on public.billing_payments;
create trigger billing_payments_not_overallocated
  before insert or update on public.billing_payments
  for each row execute function public.check_receipt_not_overallocated();

-- ── invoices.paid_cents is a SUM, so let the database own it ──────────────
-- Kept here rather than in the API because an invoice's paid figure has to be
-- right no matter what wrote the allocation: a second route, a backfill, a
-- correction typed straight into the SQL editor. The status wording stays in
-- lib/billing-docs, which is tested; this only owns the arithmetic.
create or replace function public.sync_invoice_paid_cents()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid;
begin
  v_invoice := coalesce(NEW.invoice_id, OLD.invoice_id);

  update public.invoices i
     set paid_cents = (
           select coalesce(sum(p.amount_cents), 0)
             from public.billing_payments p
            where p.invoice_id = i.id
         ),
         updated_at = now()
   where i.id = v_invoice;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists billing_payments_sync_invoice on public.billing_payments;
create trigger billing_payments_sync_invoice
  after insert or update or delete on public.billing_payments
  for each row execute function public.sync_invoice_paid_cents();

alter table public.billing_receipts enable row level security;

comment on table public.billing_receipts is
  'Money that arrived, one row per bank line. Allocated to invoices through billing_payments; a receipt with unallocated cents is unapplied cash, which is a normal state rather than an error.';
comment on column public.billing_payments.receipt_id is
  'The bank line this allocation came out of. Null for money recorded straight onto an invoice, such as a Paystack collection.';
