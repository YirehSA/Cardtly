-- Migration 086: give a card event some idea of who it came from.
--
-- WHY. Card events carry no notion of a visitor, so a duplicate view could
-- only ever be guessed at. Cleaning the historical ones showed how weak the
-- guess is. The only fingerprint available was device+browser+os, and
-- "desktop / Chrome / Windows" matches thousands of people, so on a card
-- getting bursty email traffic two strangers arriving three seconds apart look
-- exactly like one browser loading twice.
--
-- Measured properly, that method could not tell the two apart at all: the rate
-- of same-fingerprint pairs stayed flat at roughly 10 to 19 per second-band
-- all the way out to thirty seconds, which is the signature of background
-- traffic rather than duplication. Only the first second stood above it. 142
-- rows looked like duplicates and about 20 of them were, and there was no way
-- to say which. So the cleanup was abandoned, correctly, and this is what
-- would have made it a factual exercise.
--
-- WHAT GOES IN THE COLUMN. Not an IP address and nothing reversible into one.
-- lib/visitor-hash.ts has the full reasoning; in short it is an HMAC, keyed
-- with a secret that never leaves the server, over the date, the card id, the
-- IP and the user agent. That makes it:
--
--   unreversible   a bare hash would not be. IPv4 is 2^32 and user agents are
--                  guessable, so anybody holding the table could hash
--                  candidates until one matched. The key stops that.
--   daily          the date is an input, so the same person is a different
--                  value tomorrow. Duplicates and unique visitors per day are
--                  answerable; following somebody for a month is not.
--   per card       the card id is an input, so one person viewing two cards
--                  produces two unrelated values. Nothing built on this can
--                  assemble a picture of an individual across the platform,
--                  and since deduplication only ever compares within one card,
--                  the scoping costs nothing.
--
-- NULLABLE ON PURPOSE. Every row already in these tables predates this and
-- will stay null, as will any event where there is nothing to identify with.
-- Null means "unknown", which is honest. A hash of two empty strings would
-- collide every anonymous visitor into a single fictional person, which is the
-- one outcome worse than not knowing.
--
-- NO GRANTS. Migration 085 left both tables closed to anon and authenticated,
-- and /api/analytics writes them with the service role, so there is nothing to
-- open here.

alter table public.card_events
  add column if not exists visitor_hash text;

alter table public.team_card_events
  add column if not exists visitor_hash text;

-- The query this exists to serve: "has this visitor already viewed this card
-- in the last few seconds", and its sibling "how many distinct people viewed
-- this card today". Both filter by card first, then visitor, then time.
-- Partial, because the historical rows are all null and indexing them would be
-- paying for a value that answers nothing.
create index if not exists card_events_visitor_idx
  on public.card_events (card_id, visitor_hash, created_at desc)
  where visitor_hash is not null;

create index if not exists team_card_events_visitor_idx
  on public.team_card_events (team_card_id, visitor_hash, created_at desc)
  where visitor_hash is not null;

comment on column public.card_events.visitor_hash is
  'Per-card, per-day HMAC of the visitor IP and user agent, keyed server-side. Not an IP and not reversible into one: rotates daily and is scoped to one card, so it can identify a repeat view of THIS card TODAY and nothing else. Null for rows written before migration 086 and for any event with nothing to identify. See lib/visitor-hash.ts.';

comment on column public.team_card_events.visitor_hash is
  'Per-card, per-day HMAC of the visitor IP and user agent, keyed server-side. Not an IP and not reversible into one: rotates daily and is scoped to one card, so it can identify a repeat view of THIS card TODAY and nothing else. Null for rows written before migration 086 and for any event with nothing to identify. See lib/visitor-hash.ts.';

-- Proof. Expected: two rows, both text and nullable, and two indexes.
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and column_name = 'visitor_hash'
 order by table_name;

select indexname from pg_indexes
 where schemaname = 'public'
   and indexname in ('card_events_visitor_idx', 'team_card_events_visitor_idx')
 order by indexname;
