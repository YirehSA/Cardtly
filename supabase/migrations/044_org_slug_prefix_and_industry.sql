-- Migration 044: the company part of a team card's URL, and the company's industry
--
-- Two columns on organizations.
--
-- card_slug_prefix
--   Team card URLs become company-firstname-surname, so a Sicon rep is at
--   /card/sicon-group-john-smith rather than /card/john-smith-a3f9k. The
--   company half is fixed and the person only supplies their name.
--
--   Stored rather than derived from the name on every read, because legal
--   names slugify badly: "Sicon Group (Pty) Ltd" would put "pty-ltd" into the
--   URL of every card the company owns, and renaming the company would
--   silently change the prefix for every card created afterwards. The backfill
--   below strips those suffixes; anything it gets wrong is editable.
--
--   EXISTING SLUGS ARE NOT TOUCHED. Cards already printed, scanned or shared
--   keep the URL they have. The prefix applies to cards created from now on,
--   and to any slug someone deliberately edits - and an edit now writes a
--   slug_redirects row, which team card renames never did.
--
-- industry
--   The company's industry, from the fixed list in lib/industries.ts. A new
--   team card prefills from it instead of starting blank, which is the whole
--   difference between the Network directory knowing what a company does and
--   forty cards sitting in "Other" because nobody filled the field in.
--   Backfilled from whatever the company's existing cards already say.

alter table public.organizations
  add column if not exists card_slug_prefix text,
  add column if not exists industry text;

comment on column public.organizations.card_slug_prefix is
  'Company half of a team card URL: /card/<prefix>-<person>. Suggested from the company name, editable by the owner. NULL means fall back to the name. Existing slugs are never rewritten by this.';

comment on column public.organizations.industry is
  'Fixed-list industry id from lib/industries.ts. New team cards prefill from it.';

-- Backfill the prefix from the company name, mirroring orgSlugPrefix() in
-- lib/card-slug.ts: drop company-form suffixes, fold to lowercase, collapse
-- anything that is not a letter or digit into single hyphens, trim, cap at 24.
--
-- Done as an UPDATE over a computed column rather than in a loop: an earlier
-- migration in this repo used FOREACH ... SLICE over a 2-D array and would
-- have written NULL over every row it touched.
update public.organizations
set card_slug_prefix = nullif(
  left(
    trim(both '-' from
      regexp_replace(
        lower(
          regexp_replace(
            name,
            '(\((pty|ltd|inc|llc|cc)\)|\y(pty|ltd|limited|inc|incorporated|llc|cc|bpk|edms)\y\.?)',
            ' ',
            'gi'
          )
        ),
        '[^a-z0-9]+', '-', 'g'
      )
    ),
    24
  ),
  ''
)
where card_slug_prefix is null;

-- Anything whose name was entirely company-form words ends up empty above and
-- was left NULL by the nullif. Fall back to the raw name so those still get a
-- prefix rather than none.
update public.organizations
set card_slug_prefix = nullif(left(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), 24), '')
where card_slug_prefix is null;

-- The company industry, taken from what its cards already claim. Mode picks
-- the most common non-null answer, so one mis-set card cannot decide it.
update public.organizations o
set industry = sub.industry
from (
  select organization_id, mode() within group (order by industry) as industry
  from public.team_cards
  where industry is not null and organization_id is not null
  group by organization_id
) sub
where sub.organization_id = o.id
  and o.industry is null;

-- And back the other way: team cards that never had an industry inherit their
-- company's. Only rows where it is null, so nothing anyone chose is
-- overwritten - a rep who deliberately set their own keeps it.
--
-- This is what puts existing companies into the Network directory. Prefilling
-- only new cards would leave every card created before today sitting in no
-- industry at all, which is the state the field was added to fix.
update public.team_cards c
set industry = o.industry
from public.organizations o
where o.id = c.organization_id
  and c.industry is null
  and o.industry is not null;
