-- Migration 084: the browser may edit a card's content, not its identity.
--
-- The same check that produced 083, run against the two tables that carry the
-- most privilege after profiles. POSTGRES RLS IS ROW LEVEL, NOT COLUMN LEVEL:
-- a policy that lets somebody edit their own row lets them edit every column
-- of it, and Supabase grants the authenticated role INSERT, UPDATE and DELETE
-- on every column of every public table by default. Before 083 there was
-- exactly one REVOKE in 82 migrations, so both tables still carry that
-- default.
--
-- WHAT THE BROWSER ACTUALLY WRITES. Every write in the app was traced. A
-- server route does NOT make a write privileged: a route that calls
-- createClient() runs as the signed-in user and is governed by these grants
-- exactly like the browser is. Only createServiceClient() / SERVICE_ROLE_KEY
-- escapes them. Sorted by which client does the writing:
--
--   organizations   19 write sites, every one of them service role.
--                   The browser never writes this table at all.
--
--   cards           three as the user - signup's insert, CardEditor's update
--                   (content fields only, see below), SettingsTabs' industry -
--                   and /api/cards/visibility, which updates the caller's own
--                   personal card with their own client. Everything else goes
--                   through the service role.
--
-- ORGANISATIONS IS THE WORSE OF THE TWO. Its columns are almost all
-- entitlement: max_seats, used_seats, business_plan_active, business_plan_tier,
-- trial_ends_at, billing_period, suspended_at, rep_id, admin_user_id,
-- locked_fields, domain_verified. /api/team deliberately inserts a new
-- organisation with business_plan_active: false because payment has not
-- happened yet, and orgEntitlesMembers (lib/org-billing.ts, added this week)
-- reads exactly that flag. So a direct insert with the flag set true is a
-- fully entitled team, free, for as many seats as max_seats is given. An
-- update is worse in a quieter way: suspended_at is the enforcement lever, and
-- the suspended party could clear it.
--
-- ON CARDS, FOUR COLUMNS MATTER MORE THAN THE REST:
--
--   slug        /card/<slug> checks cards BEFORE team_cards, so a personal
--               card holding a team card's slug serves in its place - every
--               printed QR, NFC tag and email signature for that team card
--               now opens somebody else's. It gets worse when the squatter's
--               trial lapses: the page 404s inside the personal branch rather
--               than falling through, so the real card stays dark. Writing the
--               column directly also skips the four things /api/slug does -
--               composing the company prefix "so it cannot be edited away",
--               isReservedSlug, the taken-check across BOTH tables (which
--               needs the service role, as a user's own client reads somebody
--               else's slug as free), and the slug_redirects row that keeps
--               everything already printed working.
--   addons      the Pro paywall. /api/card/addons checks
--               plan.tier === 'pro' && plan.isActive before it writes
--               contactExchange, questionnaireEnabled and cardtlyBadge. The
--               check is in the route; the column was writable without it.
--   archived,   assert_card_assignment_consistency and the public RLS policy
--   assigned_   decide whether a card serves at all. These are the columns
--   user_id     that had the 'andre' card dead for four days.
--   is_primary, which card a person's link opens, set by
--   redirect_to_ /api/account/primary-card after it works out the winner.
--   slug
--
-- CardEditor's payload is `{ ...form, color_theme, updated_at }`, and `form`
-- is built field by field from content columns only: name, title, bio, the
-- socials, the image slots, the link slots. It touches none of the above, so
-- none of this narrows what the card editor can save.

-- ── 1. organizations: the browser writes nothing, so it may write nothing ───
--
-- No grant back. This is 035's shape (team_cards) rather than 083's: there is
-- no column the signed-in user needs, so there is no column list to get wrong.
-- SELECT is untouched - the dashboard reads the organisation as the user.

revoke insert, update, delete on public.organizations from authenticated;

comment on table public.organizations is
  'One row per team. The authenticated role may SELECT only: every write in the app goes through the service role, because every column here is either billing (business_plan_active, trial_ends_at, billing_period, max_seats) or control (admin_user_id, suspended_at, locked_fields, rep_id). Before migration 084 an account holder could insert a fully entitled organisation for themselves, or clear their own suspension.';

-- ── 2. cards: content is the browser's, identity is the server's ────────────
--
-- REVOKE FIRST, THEN GRANT BACK. Column-level revokes do not work against a
-- table-level grant - Postgres ignores them - so removing the table privilege
-- is the only way to make the column list mean anything.

revoke insert, update, delete on public.cards from authenticated;

-- INSERT is exactly what app/signup/SignupForm.tsx writes and nothing else.
-- lib/account-setup.ts inserts cards too, with the service role, so it is
-- unaffected. assigned_user_id is in the list on purpose: a card created
-- without it is written straight to archived by the trigger and 404s while
-- looking healthy in the dashboard.
grant insert (
  user_id, assigned_user_id, name, company, email, slug, is_primary, color_theme
) on public.cards to authenticated;

-- UPDATE is every column EXCEPT the ones below. Written as a deny list because
-- cards has 212 columns and a 200-name grant list is not something anybody can
-- review; the eighteen names below are the ones a reader needs to see.
do $$
declare
  denied text[] := array[
    -- identity
    'id', 'created_at',
    -- ownership
    'user_id', 'assigned_user_id', 'member_user_id',
    -- which team, which company
    'organization_id', 'org_id', 'team_id',
    -- the URL, and everything that composes or redirects it
    'slug', 'slug_prefix', 'slug_suffix', 'slug_user_part', 'redirect_to_slug',
    -- whether, and as what, the card serves
    'is_primary', 'archived',
    -- paid features, analytics integrity, brand locks
    'addons', 'view_count', 'template_locked_fields'
  ];
  missing text[];
  cols text;
begin
  -- A TYPO HERE WOULD BE SILENT AND WOULD LEAVE THE HOLE OPEN. A misspelt
  -- name matches no column, so it is "denied" for free while the real column
  -- falls into the grant. That failure looks identical to success, so check
  -- the names exist and refuse to run if any does not.
  select array_agg(d) into missing
    from unnest(denied) d
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'cards' and column_name = d
   );
  if missing is not null then
    raise exception 'public.cards has no column(s): %. Nothing was granted.',
      array_to_string(missing, ', ');
  end if;

  select string_agg(quote_ident(column_name), ', ' order by column_name)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cards'
     and not (column_name = any (denied));

  execute format('grant update (%s) on public.cards to authenticated', cols);
end $$;

-- allow_homepage_feature and hide_from_network are deliberately NOT denied.
-- /api/cards/visibility updates the caller's own personal card with their own
-- client, so denying either would break the visibility toggles. Neither
-- confers anything: the homepage rotation applies its own quality filter on
-- top of the opt-in.

comment on table public.cards is
  'One row per personal card. The authenticated role may write CONTENT columns only. Identity (id, user_id, assigned_user_id, organization_id, slug and its parts, redirect_to_slug), serving state (archived, is_primary), paid features (addons) and view_count are service role only, because the rules that govern them live in /api/slug, /api/card/addons, /api/account/primary-card and /api/cards/restore rather than in the column. Set by migration 084. ADDING A COLUMN: a new content column needs adding to this grant, or the card editor will fail on it with "permission denied for column".';

-- ── 3. and the slug cannot collide, whoever writes it ───────────────────────
--
-- The grant above stops the browser CHANGING a slug, but signup has to be able
-- to SET one, so INSERT still carries the column. Without a constraint, the
-- takeover above is still reachable by inserting a second card rather than
-- updating the first. /api/slug already tries to enforce this in application
-- code and cannot do it completely: its taken-check and its write are two
-- statements, so two requests can both pass the check and both write.
--
-- Checked before writing this: 46 cards and 52 team_cards hold a slug, with
-- zero duplicates within cards and zero slugs held by both tables. Every
-- statement below applies cleanly to the data as it stands.

create unique index if not exists cards_slug_key on public.cards (slug);

-- SECURITY DEFINER because the point is to see rows the writing role cannot:
-- team_cards RLS shows a member only their own row, which is precisely how a
-- user's own client reads an occupied slug as free.
create or replace function public.assert_slug_free_in_other_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other text := case tg_table_name when 'cards' then 'team_cards' else 'cards' end;
  taken boolean;
begin
  if new.slug is null then
    return new;
  end if;
  -- Only when the slug actually moves, so ordinary edits to a card whose slug
  -- has not changed never pay for the lookup.
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;

  execute format('select exists (select 1 from public.%I where slug = $1)', other)
    into taken using new.slug;

  if taken then
    raise exception 'The link % already belongs to another card', new.slug
      using errcode = 'unique_violation',
            hint = 'Slugs are shared between personal and team cards.';
  end if;

  return new;
end $$;

drop trigger if exists cards_slug_not_taken on public.cards;
create trigger cards_slug_not_taken
  before insert or update of slug on public.cards
  for each row execute function public.assert_slug_free_in_other_table();

drop trigger if exists team_cards_slug_not_taken on public.team_cards;
create trigger team_cards_slug_not_taken
  before insert or update of slug on public.team_cards
  for each row execute function public.assert_slug_free_in_other_table();

-- Proof, in the result pane. Expected:
--   cards          INSERT  assigned_user_id, color_theme, company, email,
--                          is_primary, name, slug, user_id
--   cards          UPDATE  194 columns, none of them the eighteen denied
--   organizations  (no rows at all)
select table_name,
       privilege_type,
       count(*) as columns
  from information_schema.column_privileges
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name in ('cards', 'organizations')
   and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
 group by table_name, privilege_type
 order by table_name, privilege_type;

-- And that none of the eighteen slipped into the UPDATE grant. Expected: no rows.
select column_name
  from information_schema.column_privileges
 where grantee = 'authenticated'
   and table_schema = 'public'
   and table_name = 'cards'
   and privilege_type = 'UPDATE'
   and column_name in (
     'id', 'created_at', 'user_id', 'assigned_user_id', 'member_user_id',
     'organization_id', 'org_id', 'team_id', 'slug', 'slug_prefix',
     'slug_suffix', 'slug_user_part', 'redirect_to_slug', 'is_primary',
     'archived', 'addons', 'view_count', 'template_locked_fields'
   );
