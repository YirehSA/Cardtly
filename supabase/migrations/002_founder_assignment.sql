-- ============================================================
-- Cardtly Promotions Phase 1 (Task 4): Founder auto-assignment
--
-- BEFORE INSERT trigger on profiles: if the current founder count
-- is below 100, mark the new row as is_founder=true and assign
-- the next sequential founder_number (1..100).
--
-- Once 100 founders exist, the trigger does nothing for subsequent
-- signups - they're just regular profiles.
--
-- The 3-month Pro grant happens via /api/promotions/grant-founder
-- (TypeScript, has access to the subscriptions table and proper
-- Pro provisioning). The lifetime upgrade for the 10 winners is
-- handled separately at the public draw event.
--
-- Safe to run multiple times.
-- ============================================================

create or replace function public.assign_founder_number() returns trigger as $$
declare
  current_count int;
  next_number int;
begin
  -- Count current founders BEFORE this insert lands
  select count(*) into current_count
  from public.profiles
  where is_founder = true;

  if current_count < 100 then
    -- Reserve the next sequential founder number (max + 1).
    -- If no founders exist yet, starts at 1.
    select coalesce(max(founder_number), 0) + 1 into next_number
    from public.profiles
    where is_founder = true;

    new.is_founder := true;
    new.founder_number := next_number;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_founder_number on public.profiles;
create trigger trg_assign_founder_number
  before insert on public.profiles
  for each row execute function public.assign_founder_number();

-- ── Verification queries (commented - run manually if curious) ──
-- select user_id, founder_number, is_founder, founder_lifetime_pro
-- from public.profiles
-- where is_founder = true
-- order by founder_number;
--
-- select count(*) as founders, max(founder_number) as last_assigned
-- from public.profiles where is_founder = true;
