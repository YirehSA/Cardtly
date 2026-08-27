-- The person half of /card/<company>/<person>.
--
-- team_cards.slug is the whole URL as one segment, company prefix and all:
-- "sicon-group-thabo-nkosi". That column does not move and every card already
-- printed keeps resolving through /card/<slug> exactly as it does today.
--
-- slug_person holds just the name part, so a group's card can be served at
-- /card/companya/thabo-nkosi. It is NULL for every card that exists now, which
-- is correct: an organisation without companies has no company segment, never
-- uses the two-part URL, and is untouched by all of this.
--
-- Two people called Thabo Nkosi in two different companies of the same group
-- is the case this exists to allow, so uniqueness is per company rather than
-- per organisation. That cannot be expressed as a plain unique index, because
-- the company is reached by walking parent_id up from the card's department -
-- it is enforced where the slug is generated, and the index below is what
-- makes that check fast.

alter table team_cards
  add column if not exists slug_person text;

create index if not exists team_cards_org_slug_person_idx
  on team_cards (organization_id, lower(slug_person))
  where slug_person is not null;

comment on column team_cards.slug_person is
  'Name part of /card/<company>/<person>. NULL for organisations with no company hierarchy, which serve only /card/<slug>. Unique within a company, enforced in lib/card-slug-server.';
