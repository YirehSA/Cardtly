-- Suspending a team, without taking it offline.
--
-- The middle ground between the two bad options. Doing nothing means a team
-- can sit unpaid forever and the only cost is ours. Taking their cards offline
-- means fifty reps hand out a dead link to their customers, which ends the
-- relationship rather than collecting the money.
--
-- A suspension keeps every card working and puts a visible notice on it. The
-- card still opens, the details still save, the QR still scans. But it no
-- longer looks finished, and the person carrying it has a reason to go and ask
-- their finance team what is going on. That is the lever: their staff chase
-- it internally, which is far more effective than us chasing invoices.
--
-- Deliberately manual. Nothing sets this automatically, because "unpaid" is a
-- judgement call: a corporate 40 days late on a debit order is normal, and
-- suspending them over it would be self-harm.

alter table public.organizations
  add column if not exists suspended_at timestamptz;

-- What the banner says. NULL uses the default copy. Kept editable because the
-- right words depend on why: a lapsed trial and a genuinely unpaid invoice
-- are not the same conversation.
alter table public.organizations
  add column if not exists suspension_message text;

-- Only ever queried as "is this org suspended", so index the few that are.
create index if not exists organizations_suspended_at_idx
  on public.organizations (suspended_at)
  where suspended_at is not null;

comment on column public.organizations.suspended_at is
  'When this team was suspended. The cards STAY LIVE and keep working: this only puts a visible notice on them. NULL means not suspended. Never set automatically; suspending is a judgement call.';
comment on column public.organizations.suspension_message is
  'Custom banner text. NULL uses the default. A lapsed trial and an unpaid invoice deserve different words.';
