-- ============================================================
-- Cardtly Promotions Phase 1: Founders, Referrals, Entries
--
-- What this does:
--   1. Adds referral_code (random 6-char) + founder flags to profiles
--   2. Auto-generates referral codes on signup (trigger)
--   3. Backfills referral codes for existing users
--   4. Creates referrals, promo_entries, promo_winners tables
--   5. Adds RLS policies (users see their own, public can see winners)
--   6. Creates founder_count view for the live counter on /promotions
--
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ── 1. Profile extensions ───────────────────────────────────
alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists is_founder boolean default false,
  add column if not exists founder_number integer,
  add column if not exists founder_lifetime_pro boolean default false;

create index if not exists idx_profiles_referral_code on public.profiles(referral_code);

-- ── 2. Random referral code generator (no ambiguous chars) ──
-- Excludes I, O, 0, 1 so codes are easy to read out loud.
create or replace function public.gen_referral_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
  end loop;
  return code;
end;
$$ language plpgsql;

-- ── 3. Auto-assign code on insert ───────────────────────────
create or replace function public.assign_referral_code() returns trigger as $$
declare
  new_code text;
  attempts int := 0;
begin
  if new.referral_code is null then
    loop
      new_code := public.gen_referral_code();
      exit when not exists (select 1 from public.profiles where referral_code = new_code);
      attempts := attempts + 1;
      if attempts > 10 then
        raise exception 'Could not generate unique referral code after 10 attempts';
      end if;
    end loop;
    new.referral_code := new_code;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_referral_code on public.profiles;
create trigger trg_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_referral_code();

-- ── 4. Backfill existing users ──────────────────────────────
-- One pass: keep generating until everyone has a unique code.
do $$
declare
  r record;
  new_code text;
  attempts int;
begin
  for r in select id from public.profiles where referral_code is null loop
    attempts := 0;
    loop
      new_code := public.gen_referral_code();
      exit when not exists (select 1 from public.profiles where referral_code = new_code);
      attempts := attempts + 1;
      exit when attempts > 10;
    end loop;
    update public.profiles set referral_code = new_code where id = r.id;
  end loop;
end $$;

-- ── 5. Referrals table ──────────────────────────────────────
-- One row per referred user (a user can only be referred by one person).
-- status transitions: pending → active (card published + viewed)
--                  → paid (became paid subscriber)
--                  → cancelled (paid sub cancelled within 30 days)
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  became_active_at timestamptz,
  became_paid_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','active','paid','cancelled')),
  unique (referred_user_id)
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_user_id);
create index if not exists idx_referrals_status on public.referrals(status);

-- ── 6. Promo entries (Tier 3 + 4 cash draws) ────────────────
-- Each row = one entry. A user has multiple rows. Cap of 10 per
-- user is enforced by the entry-assignment job, not the schema.
create table if not exists public.promo_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null
    check (tier in ('tier3_1000','tier3_2500','tier3_5000','tier4_10000')),
  source text not null
    check (source in ('paid','referral','social_instagram','social_facebook','hashtag','tag_friend','email_alt')),
  created_at timestamptz not null default now()
);

create index if not exists idx_promo_entries_user on public.promo_entries(user_id);
create index if not exists idx_promo_entries_tier on public.promo_entries(tier);

-- ── 7. Promo winners (public board) ─────────────────────────
create table if not exists public.promo_winners (
  id uuid primary key default gen_random_uuid(),
  tier text not null
    check (tier in (
      'tier1_founder_lifetime','tier1_founder_3m',
      'tier2_website_full','tier2_website_starter',
      'tier3_1000','tier3_2500','tier3_5000',
      'tier4_10000'
    )),
  prize text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  drawn_at timestamptz not null default now(),
  drawn_by text
);

create index if not exists idx_promo_winners_tier on public.promo_winners(tier);

-- ── 8. Row-level security ───────────────────────────────────
alter table public.referrals enable row level security;
alter table public.promo_entries enable row level security;
alter table public.promo_winners enable row level security;

-- Users can see their own referrals (the people they referred)
drop policy if exists "users see own referrals as referrer" on public.referrals;
create policy "users see own referrals as referrer" on public.referrals
  for select using (auth.uid() = referrer_user_id);

-- Users can see their own entries
drop policy if exists "users see own entries" on public.promo_entries;
create policy "users see own entries" on public.promo_entries
  for select using (auth.uid() = user_id);

-- Anyone (even logged-out) can see the winners board
drop policy if exists "anyone can see winners" on public.promo_winners;
create policy "anyone can see winners" on public.promo_winners
  for select using (true);

-- All writes go through the service role (server-side API routes) - no
-- insert/update/delete policies for authenticated users on these tables.

-- ── 9. Founder count view (public, for live counter) ────────
-- Counts how many of the 100 founder slots have been claimed.
create or replace view public.founder_count as
select
  count(*) filter (where is_founder = true) as filled,
  100 - count(*) filter (where is_founder = true) as remaining,
  100 as total
from public.profiles;

grant select on public.founder_count to anon, authenticated;
