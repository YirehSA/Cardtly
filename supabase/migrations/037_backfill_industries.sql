-- Migration 037: seed industries on the cards that already exist
--
-- The Network's niche filter is useless until cards carry an industry, and
-- nobody will go and set one on a field they have never seen. This fills in
-- the companies already on the platform so the filter works the day it ships.
--
-- Every value below was read off that company's own cards - their job titles
-- and bios - not guessed from the name. Companies whose cards said nothing
-- identifying are deliberately left NULL rather than filed somewhere plausible
-- and wrong: an empty filter is honest, a wrong one is not. They are listed at
-- the bottom.
--
-- Matching normalises case, punctuation and spacing the same way companyKey()
-- in lib/industries.ts does, so the variants already in the data all land on
-- one key: "Cherry on Top" and "Cherry On Top", the trailing space on
-- "Robust Mobile Fitness ", and the "(Pty) Ltd" suffixes.
--
-- Only rows with industry IS NULL are touched, so this is safe to re-run and
-- will never overwrite a choice a member made themselves.

create temporary table industry_map(company_norm text primary key, industry text) on commit drop;

insert into industry_map(company_norm, industry) values
  -- construction & trades
  ('sicon group',                                     'construction'),
  ('ab restorations',                                 'construction'),
  ('verf',                                            'construction'),  -- Afrikaans for paint
  -- motor
  ('umndeni off-road customs pty ltd',                'motor'),
  ('westrand select',                                 'motor'),         -- "quality pre-owned vehicles"
  ('mcmotors',                                        'motor'),         -- "Sales Executive"
  -- IT & software
  ('cardtly',                                         'it'),
  ('yireh business solutions',                        'it'),
  ('novatech global',                                 'it'),            -- CTO, "digital transformation"
  -- marketing & design
  ('sun scale agency',                                'marketing'),     -- "we build professional websites"
  ('vellvii',                                         'marketing'),     -- "brand development"
  ('ux design co',                                    'marketing'),     -- "UX Designer"
  -- legal
  ('ntsako venite inc',                               'legal'),         -- "Advocate"
  -- media & photography
  ('cherry on top productions',                       'media'),
  ('35media',                                         'media'),
  ('pieter pieters photography',                      'media'),
  ('the sound guy',                                   'media'),
  ('slv collective',                                  'media'),         -- "Photographer, Videographer"
  -- hospitality & travel
  ('bst tours & mrshuttle',                           'hospitality'),
  ('okavasai tours & travel',                         'hospitality'),
  -- medical
  ('inneed therapy',                                  'medical'),
  ('first medical',                                   'medical'),
  -- beauty & wellness
  ('rep culture',                                     'beauty'),        -- "personal trainer"
  ('robust mobile fitness',                           'beauty'),
  -- the rest
  ('decohigh manufacturing',                          'manufacturing'),
  ('glue devil nation adhesive distributors pty ltd', 'retail'),        -- national distributor
  ('jingle bells',                                    'education'),     -- "Ballet Teacher"
  ('hebron gemeente',                                 'nonprofit'),     -- congregation
  ('fairprocess practical support',                   'professional'),  -- workplace relations
  ('greenspark consulting',                           'professional');  -- sustainability consulting

update public.cards c
   set industry = m.industry
  from industry_map m
 where c.industry is null
   and regexp_replace(
         regexp_replace(lower(trim(both from coalesce(c.company, ''))), '[.,()]', '', 'g'),
         '\s+', ' ', 'g'
       ) = m.company_norm;

update public.team_cards t
   set industry = m.industry
  from industry_map m
 where t.industry is null
   and regexp_replace(
         regexp_replace(lower(trim(both from coalesce(t.company, ''))), '[.,()]', '', 'g'),
         '\s+', ' ', 'g'
       ) = m.company_norm;

-- Left NULL on purpose - their cards carry nothing that identifies the trade,
-- and their owners can set it themselves in Settings:
--   Eternity Mode Sdn. Bhd.  title "Chief Executive Officer", no bio
--   Final Words UK Ltd       title "Director", no bio
--   Melan interiors          no title, no bio (and no logo, so hidden anyway)
-- Plus the junk rows (a company field containing a phone number, "Test
-- Company"), which are hidden from the grid anyway as single-person entries
-- with no logo.
