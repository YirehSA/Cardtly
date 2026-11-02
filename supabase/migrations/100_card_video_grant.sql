-- 100: let the card editor write the video columns that 099 added.
--
-- Migration 084 revoked UPDATE on cards from the authenticated role and granted
-- it back as an explicit list of columns (087 and 088 had to add theirs the same
-- way). 099 added video_url, video_title and show_video without the grant, and
-- the personal card editor writes from the browser with the user's own session
-- and sends all three on every save, so from the moment 099 ran every personal
-- card save was refused with "permission denied". This restores them.
--
-- team_cards needs no grant: its saves go through /api/team/card/save with the
-- service role (085 revoked every browser write on it).

grant update (video_url, video_title, show_video) on public.cards to authenticated;
