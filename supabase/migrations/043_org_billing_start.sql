-- Migration 043: when an enterprise team's debit order actually starts
--
-- An enterprise team is signed on a debit order but usually gets a free run
-- first. Until now the only way to express that was to park the org on
-- billing_period = 'trial' and remember to switch it to 'debit_order' later,
-- which has two problems: nothing chases a trial for money, so a forgotten
-- switch means a customer who is live and never invoiced; and while it sits on
-- 'trial' the admin panel reports it as R0 revenue, so the pipeline is
-- understated.
--
-- With this the org is 'debit_order' from the day it is signed - counted as
-- revenue, visible as a real customer - and this date says when collection
-- begins. Before it, orgNeedsCollecting stays quiet. That matters because a
-- debit_order org with no collection recorded is flagged immediately, so
-- without this column setting one up in advance would nag every day of the
-- free period until the warning became noise.
--
-- NULL means collect from now, which is how every existing debit_order team
-- already behaves. Nothing changes for them.

alter table public.organizations
  add column if not exists billing_starts_on date;

comment on column public.organizations.billing_starts_on is
  'For a debit_order team: the date collection begins. Free before it, and orgNeedsCollecting stays quiet until then. NULL means collect immediately. Ignored for other billing modes.';
