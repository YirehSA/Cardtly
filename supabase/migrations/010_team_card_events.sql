-- Migration 010: team_card_events
--
-- Mirror of card_events for team cards. Storing team-card analytics
-- in their own table (rather than adding a nullable team_card_id
-- column to card_events) keeps the existing dashboard-managed
-- trigger that drives cards.view_count completely isolated, so we
-- can't accidentally break personal-card tracking by changing the
-- shape of card_events.
--
-- /api/analytics inserts a row here whenever a public team card
-- page is loaded (event_type='view'), so we can later show "views
-- in the last 30 days" instead of just the running counter on
-- team_cards.view_count.

create table if not exists public.team_card_events (
  id           uuid primary key default gen_random_uuid(),
  team_card_id uuid not null references public.team_cards(id) on delete cascade,
  event_type   text not null,
  link_title   text,
  device       text,
  browser      text,
  os           text,
  referrer     text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_team_card_events_team_card_id_created_at
  on public.team_card_events (team_card_id, created_at desc);

create index if not exists idx_team_card_events_created_at
  on public.team_card_events (created_at desc);

alter table public.team_card_events enable row level security;

-- Anyone can insert events (analytics is anonymous - we don't have
-- a session for the public card viewer). The /api/analytics route
-- uses the user-context client, so anon sessions need INSERT
-- permission to log views.
drop policy if exists "anyone can log team card events" on public.team_card_events;
create policy "anyone can log team card events"
  on public.team_card_events
  for insert
  to anon, authenticated
  with check (true);

-- Only the team card owner (claimed user_id) and the org admin
-- should be able to read events. Admin reads via service-role
-- bypass RLS, so this policy is only for the dashboard.
drop policy if exists "team card owner reads events" on public.team_card_events;
create policy "team card owner reads events"
  on public.team_card_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_cards tc
      left join public.organizations o on o.id = tc.organization_id
      where tc.id = team_card_events.team_card_id
        and (tc.user_id = auth.uid() or o.admin_user_id = auth.uid())
    )
  );

comment on table public.team_card_events is
  'Per-event log for team card public-page interactions. Mirrors card_events.';
