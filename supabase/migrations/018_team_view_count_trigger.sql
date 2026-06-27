-- Migration 018: fix team card view_count (trigger + backfill)
--
-- team_cards.view_count was undercounting: the app incremented it with
-- the anonymous visitor's session, which RLS blocks on team_cards, so
-- most increments silently failed while team_card_events still logged
-- the view. Result: all-time (view_count) ended up LOWER than the
-- 30-day count derived from the event log - which is impossible.
--
-- Personal cards avoid this with a Supabase-side trigger on card_events.
-- This gives team cards the same: a SECURITY DEFINER trigger that bumps
-- view_count on every view event, server-side, so RLS can't block it.
-- The app-side increment is removed in the same change (see
-- app/api/analytics) to avoid double counting.

-- 1. Backfill view_count from the authoritative event log.
update public.team_cards tc
set view_count = sub.cnt
from (
  select team_card_id, count(*)::int as cnt
  from public.team_card_events
  where event_type = 'view'
  group by team_card_id
) sub
where sub.team_card_id = tc.id;

-- Cards with zero logged views get 0 (in case the column held stale data).
update public.team_cards tc
set view_count = 0
where not exists (
  select 1 from public.team_card_events e
  where e.team_card_id = tc.id and e.event_type = 'view'
);

-- 2. Trigger to keep it in sync going forward.
create or replace function public.bump_team_card_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type = 'view' then
    update public.team_cards
      set view_count = coalesce(view_count, 0) + 1
      where id = new.team_card_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_team_card_view_count on public.team_card_events;
create trigger trg_bump_team_card_view_count
  after insert on public.team_card_events
  for each row execute function public.bump_team_card_view_count();
