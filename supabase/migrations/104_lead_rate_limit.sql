-- 104: rate limits for the public lead forms (lib/lead-guard).
--
-- One row per lead-form submission that was let through: a keyed, daily-
-- changing hash of the visitor (connection and browser), one of the network
-- (connection only), and the card id the form named. No IP address is stored,
-- and nothing here can be turned back into one without the server's key. Rows
-- older than two days are deleted as new ones arrive.
--
-- lead_rate_take checks all five limits and records the submission in one call,
-- returning null when it may go ahead and the name of the limit it hit when it
-- may not. The numbers must match LIMITS in lib/lead-guard;
-- scripts/check-lead-guard compares them.
--
-- Only the service role may call it or touch the table. A function is
-- executable by PUBLIC by default in Postgres, so that is revoked explicitly.

create table if not exists public.lead_rate_events (
  id bigint generated always as identity primary key,
  visitor text not null,
  network text not null,
  card text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_rate_events_visitor_idx on public.lead_rate_events (visitor, created_at);
create index if not exists lead_rate_events_network_idx on public.lead_rate_events (network, created_at);
create index if not exists lead_rate_events_card_idx on public.lead_rate_events (card, created_at);
create index if not exists lead_rate_events_created_idx on public.lead_rate_events (created_at);

alter table public.lead_rate_events enable row level security;

grant select, insert, update, delete on public.lead_rate_events to service_role;

create or replace function public.lead_rate_take(p_visitor text, p_network text, p_card text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Housekeeping, about one call in fifty: nothing older than two days is
  -- needed for any of the limits below.
  if random() < 0.02 then
    delete from lead_rate_events where created_at < now() - interval '2 days';
  end if;

  if (select count(*) from lead_rate_events where visitor = p_visitor and created_at > now() - interval '10 minutes') >= 6 then
    return 'visitor_10m';
  end if;
  if (select count(*) from lead_rate_events where visitor = p_visitor and created_at > now() - interval '1 day') >= 40 then
    return 'visitor_day';
  end if;
  if (select count(*) from lead_rate_events where network = p_network and created_at > now() - interval '10 minutes') >= 30 then
    return 'network_10m';
  end if;
  if (select count(*) from lead_rate_events where network = p_network and created_at > now() - interval '1 day') >= 300 then
    return 'network_day';
  end if;
  if (select count(*) from lead_rate_events where card = p_card and created_at > now() - interval '1 hour') >= 200 then
    return 'card_hour';
  end if;

  insert into lead_rate_events (visitor, network, card) values (p_visitor, p_network, p_card);
  return null;
end;
$$;

revoke all on function public.lead_rate_take(text, text, text) from public, anon, authenticated;
grant execute on function public.lead_rate_take(text, text, text) to service_role;
