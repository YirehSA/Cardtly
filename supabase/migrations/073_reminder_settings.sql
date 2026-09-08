-- Migration 073: how overdue invoices get chased
--
-- Two settings, and the default on the second one is the important part.
--
-- reminder_days is the ladder, in days past the due date. Three rungs by
-- default: a nudge, a firmer one, and a final notice. Stored rather than
-- hardcoded because "when do we chase" is a business decision that should not
-- need a deploy.
--
-- auto_send_reminders is OFF by default, deliberately. Cardtly's stated rule
-- for recurring invoices is that a person approves every send, and a chaser is
-- still an email arriving in a client's inbox with our name on it. The safe
-- default is a queue that says who is late and sends on one click; turning
-- this on is a decision somebody makes once, on purpose, having seen what the
-- queue looks like.

alter table public.billing_settings
  add column if not exists reminder_days integer[] not null default '{3,14,30}',
  add column if not exists auto_send_reminders boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_settings_reminder_days_check') then
    alter table public.billing_settings
      add constraint billing_settings_reminder_days_check
      -- At most five rungs, none negative, none beyond a year. A ladder with
      -- twenty rungs is not a policy, it is harassment.
      check (
        array_length(reminder_days, 1) between 1 and 5
        and reminder_days <@ (select array_agg(g) from generate_series(0, 365) g)
      );
  end if;
end $$;

comment on column public.billing_settings.reminder_days is
  'Days past the due date at which to chase. Each rung sends at most one reminder ever, and a missed run catches up one rung rather than firing all of them at once.';
comment on column public.billing_settings.auto_send_reminders is
  'Off by default on purpose. Off means the queue shows who is late and a person sends; on means the daily cron sends them without asking.';
