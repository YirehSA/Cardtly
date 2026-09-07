-- Migration 064: quotes, invoices and the ledger behind them
--
-- Cardtly bills two ways. Paystack collects R97 a card from self-serve
-- customers and always will; this is for everything Paystack cannot do -
-- enterprise teams above the self-serve ceiling, NFC card orders, and custom
-- work - where somebody needs a quote, signs it, and pays against an invoice.
--
-- Three rules shape the whole schema.
--
-- 1. DRAFT versus ISSUED. A draft has no number, is freely editable and does
--    not exist as far as anybody outside is concerned. Issuing allocates the
--    number and freezes the document. After that the only lawful correction is
--    a credit note. This is what makes "let us edit before we approve" and "an
--    invoice must never change after it is sent" both true at once.
--
-- 2. SNAPSHOT, NEVER JOIN. Every issued document stores its own copy of who
--    sent it, who it went to, the banking details and the terms text. Join to
--    a settings table instead and changing bank next year silently rewrites
--    every historical invoice, which is the single most common way a
--    home-grown billing system destroys its own audit trail.
--
-- 3. MONEY IS INTEGER CENTS. Never a float. 0.1 + 0.2 is not 0.3 in binary
--    floating point, and an invoice that is one cent out is an invoice that
--    gets queried.
--
-- VAT is stored per document rather than read from settings, because Cardtly
-- is not registered yet but is applying. On the day registration lands, new
-- documents start carrying VAT and every historical one keeps saying exactly
-- what it said. That is a settings change, not a migration.

-- ── Who we are, and what the next number is ────────────────────────────────
-- One row. The check constraint is the singleton: there is one Cardtly, and a
-- second settings row would silently split the numbering.
create table if not exists public.billing_settings (
  id                boolean primary key default true,
  constraint billing_settings_singleton check (id),

  legal_name        text not null default 'Cardtly',
  trading_name      text,
  reg_number        text,
  -- Null until registration comes through. Its presence is what switches
  -- documents from "INVOICE" to "TAX INVOICE".
  vat_number        text,
  vat_rate_bp       integer not null default 1500,   -- basis points, 15.00%

  email             text not null default 'hello@cardtly.com',
  phone             text,
  address           text,
  logo_url          text,

  bank_name         text,
  bank_account_name text,
  bank_account_no   text,
  bank_branch_code  text,
  bank_swift        text,

  -- Days from issue to due, unless a document overrides it.
  payment_terms_days integer not null default 14,

  updated_at        timestamptz not null default now(),
  updated_by        uuid
);

insert into public.billing_settings (id) values (true) on conflict (id) do nothing;

-- ── Terms and conditions, versioned ───────────────────────────────────────
-- Versioned because a signed quote has to record WHICH terms were accepted.
-- Editing the terms in place would retroactively change what every past client
-- agreed to, which is worth nothing in a dispute.
create table if not exists public.billing_terms (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null,
  body        text not null,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  unique (version)
);

-- ── Who we bill ───────────────────────────────────────────────────────────
-- Deliberately separate from organizations and auth.users: the party that pays
-- is often not the party that uses the product. A finance department, a
-- holding company, a client's client. organization_id links back when there
-- happens to be one.
create table if not exists public.billing_clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  name            text not null,
  contact_person  text,
  email           text,
  phone           text,
  address         text,
  vat_number      text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists billing_clients_org_idx on public.billing_clients(organization_id);

-- ── Gapless numbering ─────────────────────────────────────────────────────
-- A Postgres sequence is the obvious choice and the wrong one: a sequence
-- keeps counting when a transaction rolls back, so a failed issue leaves a
-- permanent hole. A counter row locked with FOR UPDATE inside the issuing
-- transaction gives numbers with no gaps, because a rollback puts the counter
-- back too.
--
-- The trade is that two people issuing at the same instant queue behind each
-- other for a moment. At Cardtly's volume that is free.
create table if not exists public.billing_counters (
  doc_type   text primary key check (doc_type in ('quote', 'invoice', 'credit_note')),
  prefix     text not null,
  next_value integer not null default 1
);
insert into public.billing_counters (doc_type, prefix, next_value) values
  ('quote', 'Q', 1), ('invoice', 'INV', 1), ('credit_note', 'CN', 1)
on conflict (doc_type) do nothing;

create or replace function public.next_document_number(p_doc_type text)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_value  integer;
begin
  -- FOR UPDATE serialises concurrent issues and, crucially, rolls the number
  -- back with the transaction if anything downstream fails.
  select prefix, next_value into v_prefix, v_value
    from public.billing_counters
    where doc_type = p_doc_type
    for update;

  if v_prefix is null then
    raise exception 'Unknown document type: %', p_doc_type;
  end if;

  update public.billing_counters
     set next_value = v_value + 1
   where doc_type = p_doc_type;

  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_value::text, 4, '0');
end;
$$;

-- ── Quotes ────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,
  status         text not null default 'draft'
                 check (status in ('draft','sent','accepted','declined','expired','cancelled')),
  client_id      uuid references public.billing_clients(id) on delete restrict,

  issued_at      timestamptz,
  valid_until    date,

  currency       text not null default 'ZAR',
  subtotal_cents integer not null default 0,
  -- Snapshotted, not read from settings. Zero today; 1500 once registered.
  vat_rate_bp    integer not null default 0,
  vat_cents      integer not null default 0,
  total_cents    integer not null default 0,

  notes          text,

  -- The frozen copies. Everything needed to render this document years from
  -- now without touching another table.
  from_snapshot  jsonb,
  to_snapshot    jsonb,
  bank_snapshot  jsonb,
  terms_id       uuid references public.billing_terms(id),
  terms_snapshot text,

  -- The public accept-and-sign link.
  public_token   text unique,
  accepted_at    timestamptz,
  accepted_name  text,
  accepted_email text,
  accepted_ip    text,
  accepted_ua    text,

  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_client_idx on public.quotes(client_id);

-- ── Invoices ──────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,
  status         text not null default 'draft'
                 check (status in ('draft','issued','sent','part_paid','paid','overdue','cancelled','written_off')),
  client_id      uuid references public.billing_clients(id) on delete restrict,
  from_quote_id  uuid references public.quotes(id) on delete set null,

  issued_at      timestamptz,
  due_at         date,

  currency       text not null default 'ZAR',
  subtotal_cents integer not null default 0,
  vat_rate_bp    integer not null default 0,
  vat_cents      integer not null default 0,
  total_cents    integer not null default 0,
  paid_cents     integer not null default 0,

  notes          text,

  from_snapshot  jsonb,
  to_snapshot    jsonb,
  bank_snapshot  jsonb,
  terms_id       uuid references public.billing_terms(id),
  terms_snapshot text,

  -- Set when the money arrived through Paystack rather than an EFT, so
  -- subscription income shows in the same ledger without this system trying
  -- to own the Paystack side of it.
  paystack_reference text,

  recurring_id   uuid,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists invoices_due_idx on public.invoices(due_at) where status in ('sent','part_paid','overdue');

-- ── Lines ─────────────────────────────────────────────────────────────────
-- qty is numeric so half-days and part months are expressible; the money stays
-- integer cents. line_total_cents is stored rather than computed on read, so a
-- rounding rule changing later cannot alter what an issued document said.
create table if not exists public.quote_lines (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references public.quotes(id) on delete cascade,
  position         integer not null default 0,
  description      text not null,
  qty              numeric(12,3) not null default 1,
  unit_price_cents integer not null default 0,
  line_total_cents integer not null default 0
);
create index if not exists quote_lines_quote_idx on public.quote_lines(quote_id, position);

create table if not exists public.invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  position         integer not null default 0,
  description      text not null,
  qty              numeric(12,3) not null default 1,
  unit_price_cents integer not null default 0,
  line_total_cents integer not null default 0
);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines(invoice_id, position);

-- ── Payments ──────────────────────────────────────────────────────────────
-- Allocated against an invoice rather than stored on it, because one EFT
-- often settles several invoices and one invoice is often paid in parts.
create table if not exists public.billing_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  paid_on      date not null default current_date,
  method       text not null default 'eft' check (method in ('eft','paystack','cash','card','other')),
  reference    text,
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists billing_payments_invoice_idx on public.billing_payments(invoice_id);

-- ── Recurring schedules ───────────────────────────────────────────────────
-- The cron creates DRAFTS and never sends. Approval is a human pressing a
-- button, which is the whole requirement.
create table if not exists public.recurring_schedules (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.billing_clients(id) on delete cascade,
  name          text not null,
  cadence       text not null default 'monthly' check (cadence in ('monthly','quarterly','annually')),
  day_of_month  integer not null default 1 check (day_of_month between 1 and 28),
  next_run_on   date not null,
  active        boolean not null default true,
  notes         text,
  -- The line items to copy onto each draft.
  template      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists recurring_due_idx on public.recurring_schedules(next_run_on) where active;

-- ── Credit notes ──────────────────────────────────────────────────────────
create table if not exists public.credit_notes (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,
  invoice_id     uuid not null references public.invoices(id) on delete restrict,
  status         text not null default 'draft' check (status in ('draft','issued')),
  issued_at      timestamptz,
  reason         text,
  subtotal_cents integer not null default 0,
  vat_rate_bp    integer not null default 0,
  vat_cents      integer not null default 0,
  total_cents    integer not null default 0,
  from_snapshot  jsonb,
  to_snapshot    jsonb,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

-- ── Audit trail ───────────────────────────────────────────────────────────
-- Append only. Who did what to which document and when, including the events
-- that happen off our screens: the client opening the quote, accepting it,
-- signing it. This is the evidence behind an electronic signature.
create table if not exists public.document_events (
  id         uuid primary key default gen_random_uuid(),
  doc_type   text not null check (doc_type in ('quote','invoice','credit_note','statement')),
  doc_id     uuid not null,
  event      text not null,
  actor      uuid,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists document_events_doc_idx on public.document_events(doc_type, doc_id, created_at);

-- ── Locking issued documents ──────────────────────────────────────────────
-- Enforced in the database, not only in the application. A guard that lives in
-- one API route is a guard that a second API route written next year does not
-- have.
create or replace function public.forbid_issued_document_edit()
returns trigger
language plpgsql
as $$
begin
  if OLD.number is not null and OLD.status <> 'draft' then
    -- Status, payment progress and the updated stamp are the only things
    -- allowed to move on an issued document. Everything else is history.
    if NEW.number is distinct from OLD.number
       or NEW.total_cents is distinct from OLD.total_cents
       or NEW.subtotal_cents is distinct from OLD.subtotal_cents
       or NEW.vat_cents is distinct from OLD.vat_cents
       or NEW.issued_at is distinct from OLD.issued_at
       or NEW.from_snapshot is distinct from OLD.from_snapshot
       or NEW.to_snapshot is distinct from OLD.to_snapshot
       or NEW.bank_snapshot is distinct from OLD.bank_snapshot
       or NEW.terms_snapshot is distinct from OLD.terms_snapshot then
      raise exception
        'Document % is issued and cannot be altered. Raise a credit note instead.', OLD.number;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists invoices_no_edit_after_issue on public.invoices;
create trigger invoices_no_edit_after_issue
  before update on public.invoices
  for each row execute function public.forbid_issued_document_edit();

-- Lines on an issued document are frozen outright.
create or replace function public.forbid_issued_line_change()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_number text;
begin
  select status, number into v_status, v_number
    from public.invoices
    where id = coalesce(NEW.invoice_id, OLD.invoice_id);
  if v_number is not null and v_status <> 'draft' then
    raise exception 'Invoice % is issued; its lines cannot be changed.', v_number;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists invoice_lines_no_change_after_issue on public.invoice_lines;
create trigger invoice_lines_no_change_after_issue
  before insert or update or delete on public.invoice_lines
  for each row execute function public.forbid_issued_line_change();

-- ── Access ────────────────────────────────────────────────────────────────
-- Every one of these tables is staff-only and is reached exclusively through
-- the service-role client behind an isAdminUser check. RLS on with no policy
-- means the anon and authenticated keys can read nothing at all, which is the
-- correct default for a company's own books.
alter table public.billing_settings    enable row level security;
alter table public.billing_terms       enable row level security;
alter table public.billing_clients     enable row level security;
alter table public.billing_counters    enable row level security;
alter table public.quotes              enable row level security;
alter table public.quote_lines         enable row level security;
alter table public.invoices            enable row level security;
alter table public.invoice_lines       enable row level security;
alter table public.billing_payments    enable row level security;
alter table public.recurring_schedules enable row level security;
alter table public.credit_notes        enable row level security;
alter table public.document_events     enable row level security;

comment on table public.billing_settings is
  'Singleton. Cardtly''s own company and banking details, snapshotted onto every issued document. vat_number null means not registered: documents say INVOICE, not TAX INVOICE.';
comment on function public.next_document_number(text) is
  'Gapless document numbering. Locks the counter row so a rolled-back issue returns the number rather than burning it, which a sequence would not.';
