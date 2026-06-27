-- Migration 019: fix personal card view_count (trigger + backfill)
--
-- Same bug as team cards (migration 018), now for personal cards:
-- cards.view_count was undercounting (often stuck at 0) while
-- card_events logged the real views - so the admin panel showed
-- last-30-days HIGHER than all-time, which is impossible.
--
-- We'd assumed a Supabase-dashboard trigger maintained
-- cards.view_count, but the data shows it isn't (reliably) firing.
-- This makes the counter authoritative: backfill from the event log,
-- then a SECURITY DEFINER trigger keeps it in sync.
--
-- NOTE: if a working view_count trigger DID already exist on
-- card_events, this would double count. The data (view_count far below
-- the event count, many cards at 0) shows it does not, so this is safe.

-- 1. Backfill from the authoritative event log.
update public.cards c
set view_count = sub.cnt
from (
  select card_id, count(*)::int as cnt
  from public.card_events
  where event_type = 'view'
  group by card_id
) sub
where sub.card_id = c.id;

-- Cards with no logged views -> 0 (clear any stale seed value).
update public.cards c
set view_count = 0
where not exists (
  select 1 from public.card_events e
  where e.card_id = c.id and e.event_type = 'view'
);

-- 2. Trigger to keep it in sync going forward (server-side, RLS-proof).
create or replace function public.bump_card_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type = 'view' then
    update public.cards
      set view_count = coalesce(view_count, 0) + 1
      where id = new.card_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_card_view_count on public.card_events;
create trigger trg_bump_card_view_count
  after insert on public.card_events
  for each row execute function public.bump_card_view_count();
