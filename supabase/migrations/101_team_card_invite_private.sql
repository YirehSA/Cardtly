-- 101: a team card's invite is no longer readable with the public key.
--
-- invite_token is the whole of a claim: /api/team/claim takes a token and a
-- password and makes an account for the invited address, signed in, with the
-- card on it. invite_email is the address of somebody who has not signed up.
-- Both were readable by anon (the key that ships in every browser) and by any
-- signed-in user, for every team card, because row level security decides
-- WHICH rows a role sees and never which columns. Found 2026-11-03: 11 live
-- cards carried a token anyone could read.
--
-- This takes SELECT on the table away from anon and authenticated and gives it
-- back column by column, every column except the three invite ones. The
-- service role (every server route) is untouched and still reads them all.
--
-- The code was changed first (2026-11-03) so that nothing reading team_cards
-- with the visitor's key or a signed-in session asks for those columns or for
-- select('*'): the card page and the owner's team screen read it with the
-- service role, and the page strips the invite before rendering
-- (lib/team-card-public). Run this after that code is live.
--
-- A column added to team_cards after this needs its own
-- `grant select (...) on public.team_cards to anon, authenticated;` if anything
-- reads it with those keys. scripts/check-migration-grants enforces it.

-- Stop, changing nothing, if a policy or a function that runs as the caller
-- reads an invite column. Either would start failing for the people it serves
-- the moment the grant below is narrowed, and neither lives in these migration
-- files (policies are kept in the Supabase dashboard).
do $$
declare
  hits text;
begin
  select string_agg(format('%I.%I policy %L', schemaname, tablename, policyname), ', ')
    into hits
    from pg_policies
   where coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ 'invite_(token|email|sent_at)';
  if hits is not null then
    raise exception 'Nothing changed. These policies read a team_cards invite column and would fail for signed-in users: %', hits;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ')
    into hits
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and not p.prosecdef
     and p.prosrc ~ 'invite_(token|email|sent_at)';
  if hits is not null then
    raise exception 'Nothing changed. These functions run as the caller and read a team_cards invite column: %', hits;
  end if;
end $$;

revoke select on public.team_cards from anon, authenticated;

grant select (
  id, organization_id, name, title, company, email, phone, work_phone,
  whatsapp, website, address, bio, linkedin_url, twitter_url, instagram_url,
  profile_image_url, company_logo_url, certifications, color_theme, slug,
  is_active, link_1_title, link_1_url, link_2_title, link_2_url,
  link_3_title, link_3_url, link_4_title, link_4_url, link_5_title,
  link_5_url, created_at, updated_at, image_1_url, image_2_url, image_3_url,
  image_4_url, image_5_url, facebook_url, image_1_link, image_2_link,
  image_3_link, image_4_link, image_5_link, image_6_url, image_6_link,
  user_id, claimed_at, view_count, allow_homepage_feature, addons,
  use_team_brand, use_team_questionnaire, department_id, industry,
  hide_from_network, org_hide_from_network, slug_person, redirect_to_slug,
  youtube, tiktok, link_6_title, link_6_url, link_7_title, link_7_url,
  link_8_title, link_8_url, link_9_title, link_9_url, link_10_title,
  link_10_url, image_7_url, image_7_link, image_8_url, image_8_link,
  image_9_url, image_9_link, image_10_url, image_10_link, image_1_title,
  image_2_title, image_3_title, image_4_title, image_5_title, image_6_title,
  image_7_title, image_8_title, image_9_title, image_10_title,
  hero_image_url, video_url, video_title, show_video
) on public.team_cards to anon, authenticated;

-- To check afterwards, as the public key would:
--   set role anon;
--   select invite_token from public.team_cards limit 1;  -- permission denied
--   select name, slug from public.team_cards limit 1;    -- still works
--   reset role;
