-- ============================================================
-- Exclude team-invite signups from the Founders 100 promotion.
--
-- The founder slot trigger (002) auto-assigns is_founder + a
-- founder_number to every new profiles row. Team members claim
-- their invite via the claim flow, which also creates a profile,
-- which would silently consume founder slots that should be
-- reserved for organic signups.
--
-- Fix: add a signup_source column (defaults to 'organic'), have
-- the claim endpoint set it to 'team_invite' when upserting the
-- new member's profile, and skip founder assignment when source
-- is 'team_invite'.
--
-- Backward compatible: existing rows keep the default 'organic'
-- so already-assigned founder numbers are untouched.
-- ============================================================

alter table public.profiles
  add column if not exists signup_source text not null default 'organic';

comment on column public.profiles.signup_source is
  'How this user signed up. organic = direct signup at cardtly.com (eligible for the Founders 100 promotion). team_invite = claimed a team-card invite (not eligible).';

-- Replace the trigger function so it short-circuits for team
-- invite signups. Logic for organic signups is unchanged.
create or replace function public.assign_founder_number() returns trigger as $$
declare
  current_count int;
  next_number int;
begin
  -- Team-invite signups are not eligible for the Founders 100.
  -- They're being added to an existing org, not signing up cold.
  if new.signup_source = 'team_invite' then
    return new;
  end if;

  select count(*) into current_count
  from public.profiles
  where is_founder = true;

  if current_count < 100 then
    select coalesce(max(founder_number), 0) + 1 into next_number
    from public.profiles
    where is_founder = true;

    new.is_founder := true;
    new.founder_number := next_number;
  end if;

  return new;
end;
$$ language plpgsql;

-- Trigger itself is unchanged (created by 002); the function
-- body it executes is what was just replaced.
