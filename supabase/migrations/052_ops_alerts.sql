-- One row per operational alert per hour, so a broken dependency tells you
-- once instead of once per user action.
--
-- Why a table and not a variable: the routes run on serverless, where each
-- instance has its own memory. An in-process "have I already emailed about
-- this" flag resets whenever a new instance starts, so a busy hour would send
-- as many emails as there are cold starts. The unique index below is the only
-- thing that holds across all of them.
--
-- Dedupe works by insert-and-catch: writing a row for (kind, hour) raises
-- 23505 if one is already there, and 23505 means "already alerted, stay quiet".
-- Same pattern as the trial email claim in the reminders cron.

create table if not exists ops_alerts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  -- Truncated to the hour by the caller. Part of the unique key, so it is what
  -- defines the quiet window.
  window_start timestamptz not null,
  detail       text,
  created_at   timestamptz not null default now()
);

create unique index if not exists ops_alerts_kind_window_key
  on ops_alerts (kind, window_start);

-- Reading recent alerts in /admin should not scan the table.
create index if not exists ops_alerts_created_at_idx
  on ops_alerts (created_at desc);

comment on table ops_alerts is
  'Throttle for operator alerts. One row per (kind, hour); a 23505 on insert means an alert for that kind already went out this hour.';
