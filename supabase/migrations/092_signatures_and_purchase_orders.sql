-- 092: signatures on documents, purchase orders, and correcting the client's
-- details on an issued invoice. (Andre, 2026-10-05, for Jetour.)
--
-- THREE THINGS.
--
-- 1. SIGNATORIES. The people who sign Cardtly's documents (Andre and Tio), each
--    with a signature image drawn or uploaded once under Billing settings.
--    Stored as a PNG data URL in a service-role-only table, never in a public
--    storage bucket: a signature anybody can fetch by URL is a signature
--    anybody can paste onto a document of their own.
--
--    An invoice carries the signatures it was signed with as a COPY
--    (invoices.signatures), for the same reason it carries a copy of the
--    client: replacing Andre's signature next year must not change what last
--    year's invoices show. Signing is not one of the frozen fields, so an
--    invoice already issued can still be signed.
--
-- 2. PURCHASE ORDERS. Some clients cannot pay without one. Cardtly drafts it
--    from the invoice (or quote), the client's department manager approves it
--    by signing through a link, and the PDF carries both signatures. Numbered
--    PO-YYYY-NNNN from the same gapless counters as everything else, starting
--    at 1001 like the rest (069). invoices.po_number is the order number the
--    invoice quotes back: ours, or the client's own if they issue one.
--
-- 3. CORRECTING THE CLIENT ON AN ISSUED INVOICE. An issued invoice keeps a copy
--    of who it was addressed to (to_snapshot), and the trigger from 064 refuses
--    any change to it. When a client's registered name, address or VAT number
--    was wrong, the invoice has to be reissued with the right ones before their
--    accounts department will pay it. refresh_invoice_recipient is the ONE way
--    to do that: it changes only to_snapshot, never the number, the lines or
--    the money, and it writes the old and new details to document_events so
--    the correction is on the record. Everything else stays frozen exactly as
--    064 made it.

-- ── 1. Signatories ──────────────────────────────────────────────────────────
create table if not exists public.billing_signatories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  title          text,
  -- data:image/png;base64,... Capped so a phone photo pasted in by mistake
  -- cannot bloat every PDF; the uploader scales images down well below this.
  signature_png  text not null
                 check (signature_png like 'data:image/png;base64,%' and length(signature_png) <= 400000),
  -- Signs every new invoice at issue without anybody ticking a box.
  sign_invoices  boolean not null default false,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.billing_signatories enable row level security;
grant select, insert, update, delete on public.billing_signatories to service_role;

comment on table public.billing_signatories is
  'People who sign Cardtly documents. Service role only: a signature image must never be publicly fetchable.';

alter table public.invoices add column if not exists signatures jsonb;
alter table public.invoices add column if not exists po_number text;

comment on column public.invoices.signatures is
  'Copies of the signatures this invoice was signed with: [{name, title, png, signedAt}]. A copy, so replacing a signature later does not alter old invoices.';
comment on column public.invoices.po_number is
  'The purchase order this invoice is raised against. Printed on the invoice. Not one of the frozen fields: clients often supply it after the invoice has gone out.';

-- ── 2. Purchase orders ──────────────────────────────────────────────────────
create table if not exists public.purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  number            text unique,
  status            text not null default 'awaiting_signature'
                    check (status in ('awaiting_signature', 'signed', 'cancelled')),
  client_id         uuid references public.billing_clients(id) on delete restrict,
  invoice_id        uuid references public.invoices(id) on delete set null,
  quote_id          uuid references public.quotes(id) on delete set null,
  -- What it was raised from, as printed: "Invoice INV-2026-1001".
  source_label      text,
  -- The client's own order number, when their system issues one.
  buyer_reference   text,

  issued_at         timestamptz not null default now(),
  currency          text not null default 'ZAR',
  subtotal_cents    integer not null default 0,
  vat_rate_bp       integer not null default 0,
  vat_cents         integer not null default 0,
  total_cents       integer not null default 0,
  notes             text,

  -- Copies, like every other document: the buyer is the client, the supplier
  -- is Cardtly.
  buyer_snapshot    jsonb,
  supplier_snapshot jsonb,
  supplier_signatures jsonb,

  -- Who has to approve it, as printed under the signature line.
  approver_role     text not null default 'Department Manager',
  approver_name     text,
  approver_email    text,

  -- The public signing link, and the evidence behind the signature.
  public_token      text unique,
  signer_name       text,
  signer_title      text,
  signer_email      text,
  signature_png     text check (signature_png is null or (signature_png like 'data:image/png;base64,%' and length(signature_png) <= 400000)),
  signed_at         timestamptz,
  signed_ip         text,
  signed_ua         text,
  -- 'link' when they signed online, 'recorded' when we entered a signature
  -- they sent back on paper.
  signed_via        text check (signed_via is null or signed_via in ('link', 'recorded')),

  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists purchase_orders_invoice_idx on public.purchase_orders(invoice_id);
create index if not exists purchase_orders_client_idx on public.purchase_orders(client_id);
alter table public.purchase_orders enable row level security;
grant select, insert, update, delete on public.purchase_orders to service_role;

create table if not exists public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  position          integer not null default 0,
  description       text not null,
  qty               numeric(12,3) not null default 1,
  unit_price_cents  integer not null default 0,
  line_total_cents  integer not null default 0
);
create index if not exists purchase_order_lines_po_idx on public.purchase_order_lines(purchase_order_id, position);
alter table public.purchase_order_lines enable row level security;
grant select, insert, update, delete on public.purchase_order_lines to service_role;

-- Numbering: one more counter, starting where the others did.
alter table public.billing_counters drop constraint if exists billing_counters_doc_type_check;
alter table public.billing_counters add constraint billing_counters_doc_type_check
  check (doc_type in ('quote', 'invoice', 'credit_note', 'purchase_order'));
insert into public.billing_counters (doc_type, prefix, next_value)
  values ('purchase_order', 'PO', 1001)
  on conflict (doc_type) do nothing;

-- The audit trail covers them too.
alter table public.document_events drop constraint if exists document_events_doc_type_check;
alter table public.document_events add constraint document_events_doc_type_check
  check (doc_type in ('quote', 'invoice', 'credit_note', 'statement', 'purchase_order'));

-- ── 3. Correcting the client on an issued invoice ───────────────────────────
-- 064's trigger, unchanged except for one door: to_snapshot may move while
-- refresh_invoice_recipient below has said so for this transaction. The
-- setting is transaction-local (set_config(..., true)), so it cannot leak into
-- any other statement, and nothing else in the codebase sets it.
create or replace function public.forbid_issued_document_edit()
returns trigger
language plpgsql
as $$
declare
  v_recipient_refresh boolean := coalesce(current_setting('cardtly.refresh_recipient', true), '') = 'on';
begin
  if OLD.number is not null and OLD.status <> 'draft' then
    if NEW.number is distinct from OLD.number
       or NEW.total_cents is distinct from OLD.total_cents
       or NEW.subtotal_cents is distinct from OLD.subtotal_cents
       or NEW.vat_cents is distinct from OLD.vat_cents
       or NEW.issued_at is distinct from OLD.issued_at
       or NEW.from_snapshot is distinct from OLD.from_snapshot
       or (NEW.to_snapshot is distinct from OLD.to_snapshot and not v_recipient_refresh)
       or NEW.bank_snapshot is distinct from OLD.bank_snapshot
       or NEW.terms_snapshot is distinct from OLD.terms_snapshot then
      raise exception
        'Document % is issued and cannot be altered. Raise a credit note instead.', OLD.number;
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.refresh_invoice_recipient(p_invoice_id uuid, p_to jsonb, p_actor uuid)
returns jsonb
language plpgsql
as $$
declare
  v_before jsonb;
  v_number text;
begin
  if p_to is null or jsonb_typeof(p_to) <> 'object' or coalesce(p_to->>'name', '') = '' then
    raise exception 'A client needs at least a name.';
  end if;

  select to_snapshot, number into v_before, v_number
    from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'No such invoice.';
  end if;

  perform set_config('cardtly.refresh_recipient', 'on', true);
  update public.invoices
     set to_snapshot = p_to, updated_at = now()
   where id = p_invoice_id;
  perform set_config('cardtly.refresh_recipient', 'off', true);

  insert into public.document_events (doc_type, doc_id, event, actor, meta)
  values ('invoice', p_invoice_id, 'recipient_refreshed', p_actor,
          jsonb_build_object('number', v_number, 'before', v_before, 'after', p_to));

  return p_to;
end;
$$;

-- Server only. Nobody signed in, let alone anonymous, may rewrite who an
-- invoice is addressed to.
revoke all on function public.refresh_invoice_recipient(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.refresh_invoice_recipient(uuid, jsonb, uuid) to service_role;

comment on function public.refresh_invoice_recipient(uuid, jsonb, uuid) is
  'The one way to change who an issued invoice is addressed to. Changes to_snapshot only and logs before/after to document_events.';

-- ── Proof ───────────────────────────────────────────────────────────────────
select 'billing_signatories' as tbl, count(*) from public.billing_signatories
union all select 'purchase_orders', count(*) from public.purchase_orders
union all select 'invoices with a po_number', count(*) from public.invoices where po_number is not null;

select doc_type, prefix, next_value from public.billing_counters order by doc_type;
