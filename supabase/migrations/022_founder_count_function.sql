-- Migration 022: replace the SECURITY DEFINER founder_count view
--
-- Supabase's Security Advisor flags public.founder_count CRITICAL:
-- as a view it bypasses RLS on profiles (it runs as the view owner).
-- It only ever exposed aggregate counts (filled / remaining / total)
-- for the public Founders-100 counter, so there was no data leak -
-- but the pattern is risky, so we move to the correct one: a scoped
-- SECURITY DEFINER function with a locked search_path. Only the three
-- counts come out; nothing from profiles is exposed.

drop view if exists public.founder_count;

create or replace function public.founder_count()
returns table (filled int, remaining int, total int)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where is_founder = true)::int as filled,
    (100 - count(*) filter (where is_founder = true))::int as remaining,
    100 as total
  from public.profiles;
$$;

-- Public counter needs anon; signed-in pages use authenticated.
grant execute on function public.founder_count() to anon, authenticated;
