-- Migration 038: keep the demo cards out of the Network directory
--
-- These are seeded demonstration cards, not members. They carry logos and
-- polished bios, so the directory had no way to tell them from real companies
-- and listed NovaTech Global and friends alongside actual businesses.
--
-- This sets the existing hide_from_network flag rather than adding a denylist
-- in code, which means it is visible in the data, reversible from the Settings
-- toggle, and needs no deploy to undo.
--
-- Targeted by slug, deliberately. All three of the named demo cards belong to
-- one account (970d0ea1-...), but so do nine genuine client cards - The Sound
-- Guy, 35Media, SLV COLLECTIVE, Vellvii, Melan interiors. That account looks
-- like a staff or agency login that builds cards on behalf of clients, so
-- hiding by user_id would have taken nine real businesses out of the directory
-- along with the three demos.

update public.cards
   set hide_from_network = true
 where slug in (
   -- Confirmed by Andre as demo cards. Created within 15 minutes of each other
   -- on 2025-09-18, with example.com and invented-company addresses.
   'jordanblake',        -- Jordan Blake, UX Design Co, jordan.blake@example.com
   'priya',              -- Priya Naidoo, GreenSpark Consulting
   'daniel',             -- Daniel Carter, NovaTech Global
   -- Cardtly's own demonstration accounts, listed under the Cardtly company
   -- and inflating its head count from 4 real people to 6.
   'demo',               -- "Demo" / "Demo Title", demo@cardtly.com
   'play-review-tzy29',  -- "Cardtly Demo", play-review@cardtly.com
   -- Andre's own test card: title "Test", no company set, so it was the one
   -- entry in the Independent section that was not a real member.
   'iweb-piet'
 );

-- Left alone on purpose, flagged rather than actioned:
--
--   nelly      "Test Job" at "Test Company", but a real user's account
--              (ntvm0412@gmail.com), so not ours to hide. Already kept out of
--              the grid by the one-person-no-logo rule, and only reachable by
--              searching for it directly.
