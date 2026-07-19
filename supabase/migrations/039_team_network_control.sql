-- Migration 039: let a team manager choose who from their team is listed
--
-- A manager may want only some of their people in the Network - client-facing
-- staff, say, and not everyone. That is a separate decision from the member's
-- own, so it gets its own column instead of sharing hide_from_network.
--
-- Sharing one flag looked simpler and is wrong: both parties can write it, so
-- a manager hiding someone and that person unhiding themselves would silently
-- overwrite each other, and whoever saved last would win.
--
-- The rule is: a card is listed only when BOTH agree.
--
--     listed = (not hide_from_network) and (not org_hide_from_network)
--
-- Either side can remove a card from the directory; neither side can force it
-- back in. That matters in one direction in particular - a member who opts out
-- for their own reasons must stay out, and a manager must not be able to
-- overrule that.

alter table public.team_cards
  add column if not exists org_hide_from_network boolean not null default false;

comment on column public.team_cards.org_hide_from_network is
  'Set by the org admin to keep this card out of the Network directory. Separate from hide_from_network, which is the member''s own choice. A card is listed only when both are false.';

-- Mirrors the 036 index, which only knew about the member's flag.
drop index if exists team_cards_network_idx;
create index if not exists team_cards_network_idx
  on public.team_cards (industry, company)
  where hide_from_network = false
    and org_hide_from_network = false
    and slug is not null
    and is_active = true;
