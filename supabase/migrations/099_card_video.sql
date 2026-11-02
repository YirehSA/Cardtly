-- 099: a video on a card, in its own section under the bio (Andre, 2026-11-02:
-- "a Video Link that plays a video (YouTube + Vimeo and so on) ... its own
-- section ... a feature that you can switch on and off").
--
--   video_url    the link to one video on YouTube, Vimeo, TikTok, Loom, Wistia
--                or Dailymotion, stored as the platform's own page for it. The
--                player address and the picture are worked out from it every
--                time it renders (lib/card-video), never stored.
--   video_title  the video's title as the platform gave it when the link was
--                saved, shown under it. The cardholder can change it.
--   show_video   the switch. Off keeps the link for later. On by default, so
--                adding a link is enough to show it.
--
-- On both cards and team_cards, as every card's own content like the bio: not
-- part of the design JSON, because a team member touching their design detaches
-- their card from the company look (components/team/TeamCardEditor), and adding
-- a video must not do that. No new tables, so no grants; RLS is unchanged.

alter table public.cards
  add column if not exists video_url text,
  add column if not exists video_title text,
  add column if not exists show_video boolean not null default true;

alter table public.team_cards
  add column if not exists video_url text,
  add column if not exists video_title text,
  add column if not exists show_video boolean not null default true;

alter table public.cards drop constraint if exists cards_video_url_length;
alter table public.cards add constraint cards_video_url_length check (video_url is null or char_length(video_url) <= 500);
alter table public.cards drop constraint if exists cards_video_title_length;
alter table public.cards add constraint cards_video_title_length check (video_title is null or char_length(video_title) <= 200);

alter table public.team_cards drop constraint if exists team_cards_video_url_length;
alter table public.team_cards add constraint team_cards_video_url_length check (video_url is null or char_length(video_url) <= 500);
alter table public.team_cards drop constraint if exists team_cards_video_title_length;
alter table public.team_cards add constraint team_cards_video_title_length check (video_title is null or char_length(video_title) <= 200);
