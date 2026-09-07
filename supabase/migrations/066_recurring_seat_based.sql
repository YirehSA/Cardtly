-- Migration 066: recurring invoices that follow the seat count
--
-- 064 modelled a recurring schedule as a fixed template of line items. That
-- works for a retainer and is wrong for Cardtly's actual product: when a team
-- adds five people, next month's invoice has to be for fifteen seats without
-- anybody remembering to open the schedule and edit it. A stored template is a
-- second copy of the seat count, and a second copy is a copy that goes stale.
--
-- So a schedule now says WHERE its amount comes from. 'seats' reads the live
-- count off the organisation at the moment the draft is generated; 'fixed'
-- keeps the template, for the arrangements that genuinely are a flat monthly
-- fee.
--
-- The cycle is the anniversary of signup, prepaid: a team that joined on the
-- 5th pays on the 5th, and nothing activates until the first payment lands.

alter table public.recurring_schedules
  -- Whose seat count to read. Null for a fixed schedule.
  add column if not exists organization_id  uuid references public.organizations(id) on delete cascade,
  add column if not exists source           text not null default 'fixed',
  -- The agreed per-seat price for THIS client. Enterprise deals are negotiated,
  -- so the list price in lib/org-billing cannot be assumed.
  add column if not exists seat_price_cents integer not null default 9700,
  -- How many days before the anniversary the draft appears for approval.
  -- Prepaid means the invoice has to be out and paid BEFORE the period starts,
  -- so a draft generated on the due date is already a month late.
  add column if not exists lead_days        integer not null default 7,
  -- What the schedule billed last time, so a seat change between runs is
  -- visible rather than inferred.
  add column if not exists last_seats       integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recurring_schedules_source_check') then
    alter table public.recurring_schedules
      add constraint recurring_schedules_source_check check (source in ('fixed', 'seats'));
  end if;
end $$;

-- A seat-based schedule is meaningless without an organisation to count.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recurring_schedules_seats_need_org') then
    alter table public.recurring_schedules
      add constraint recurring_schedules_seats_need_org
      check (source <> 'seats' or organization_id is not null);
  end if;
end $$;

-- day_of_month was capped at 28 so every month would have one. The anniversary
-- is clamped in code instead (anniversaryOn in lib/billing-docs), which bills a
-- team that joined on the 31st on the 28th, 29th, 30th or 31st depending on the
-- month. Storing the real signup day rather than a safe substitute keeps the
-- 31st a 31st in the months that have one.
alter table public.recurring_schedules
  drop constraint if exists recurring_schedules_day_of_month_check;
alter table public.recurring_schedules
  add constraint recurring_schedules_day_of_month_check check (day_of_month between 1 and 31);

comment on column public.recurring_schedules.source is
  '''seats'' reads the live count off the organisation when the draft is generated, so a seat change needs no edit here. ''fixed'' uses the stored template.';
comment on column public.recurring_schedules.lead_days is
  'Days before the anniversary that the draft appears for approval. Prepaid billing needs the invoice paid before the period starts.';
