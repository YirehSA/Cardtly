-- ============================================================
-- Founder slot reuse.
--
-- The previous trigger (002 + 006) assigned founder_number =
-- max(founder_number) + 1 from existing rows. That means once an
-- admin clears a founder slot (e.g. a test account or a Google
-- Play reviewer who tripped the auto-assignment), the freed
-- number is gone forever and the next signup gets 101+ which
-- breaks the "first 100" promotion semantics.
--
-- Fix: pick the LOWEST unused number in 1..100. Slots come back
-- into the pool the moment a founder is removed.
--
-- All other trigger logic (team-invite skip, 100-cap, etc.)
-- preserved.
-- ============================================================

create or replace function public.assign_founder_number() returns trigger as $$
declare
  next_number int;
begin
  -- Team-invite signups are not eligible for the Founders 100.
  if new.signup_source = 'team_invite' then
    return new;
  end if;

  -- Smallest unused number in 1..100. NULL means all 100 are taken
  -- (or there's no gap and we're at 100), in which case we leave
  -- is_founder / founder_number as their defaults (false / null).
  select min(s.n) into next_number
  from generate_series(1, 100) s(n)
  where not exists (
    select 1 from public.profiles where founder_number = s.n
  );

  if next_number is not null then
    new.is_founder := true;
    new.founder_number := next_number;
  end if;

  return new;
end;
$$ language plpgsql;
