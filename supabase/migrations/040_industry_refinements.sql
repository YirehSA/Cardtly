-- Migration 040: move cards onto the industries added alongside this
--
-- The list in lib/industries.ts grew from 21 to 44, and several companies were
-- filed in 037 under the closest thing available at the time rather than the
-- right thing. Adding a category without moving them is worse than not adding
-- it: a member filtering the Network by "Travel & Tourism" would find it empty
-- while two tour operators sat under Hospitality.
--
-- Every row below is one the 037 backfill inferred, not one a member chose.
-- Each update is guarded on the industry still holding exactly the value that
-- backfill set, so anyone who has since picked their own keeps it.

-- Tour operators: hospitality -> travel
update public.cards      set industry = 'travel'
 where industry = 'hospitality'
   and lower(trim(company)) in ('bst tours & mrshuttle', 'okavasai tours & travel');
update public.team_cards set industry = 'travel'
 where industry = 'hospitality'
   and lower(trim(company)) in ('bst tours & mrshuttle', 'okavasai tours & travel');

-- "National Adhesive Distributors ... 30 years" is a distributor, not a shop.
-- retail -> wholesale
update public.cards      set industry = 'wholesale'
 where industry = 'retail'
   and lower(trim(company)) like 'glue devil nation adhesive distributors%';
update public.team_cards set industry = 'wholesale'
 where industry = 'retail'
   and lower(trim(company)) like 'glue devil nation adhesive distributors%';

-- A Gemeente is a congregation. nonprofit -> religious
update public.cards      set industry = 'religious'
 where industry = 'nonprofit' and lower(trim(company)) = 'hebron gemeente';
update public.team_cards  set industry = 'religious'
 where industry = 'nonprofit' and lower(trim(company)) = 'hebron gemeente';

-- "independent workplace relations support service" is HR, which had no
-- category of its own before. professional -> hr
update public.cards      set industry = 'hr'
 where industry = 'professional' and lower(trim(company)) = 'fairprocess practical support';
update public.team_cards  set industry = 'hr'
 where industry = 'professional' and lower(trim(company)) = 'fairprocess practical support';

-- Left NULL by 037 because nothing on the card said what the trade was, and
-- "interiors" did not exist as a category then. Only fills where still unset.
update public.cards      set industry = 'interiors'
 where industry is null and lower(trim(company)) = 'melan interiors';
update public.team_cards  set industry = 'interiors'
 where industry is null and lower(trim(company)) = 'melan interiors';

-- Still deliberately NULL, because their cards carry a job title and nothing
-- else: Eternity Mode Sdn. Bhd. and Final Words UK Ltd. Their owners can pick
-- from the longer list themselves.
