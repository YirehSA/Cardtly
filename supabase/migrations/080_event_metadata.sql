-- Migration 080: one generic metadata column on each event table
--
-- ADDITIVE AND NOTHING ELSE. Two nullable columns. No default, no backfill, no
-- rewrite of existing rows, no table recreation, no index. Every event already
-- in these tables stays exactly as it is and reads back with metadata null.
--
-- WHY GENERIC RATHER THAN CONTEXT-SPECIFIC. Cardtly Context is the reason this
-- is needed now, but it will not be the last feature that wants a little
-- structured attribution on an event: Connections, Smart Handoff, campaigns and
-- lead attribution are all sketched to follow. A `context jsonb` column would
-- have meant another migration for each of them. A namespaced payload does not:
--
--   { "context":    { "audience": "it", "source": "sender", "version": 1 } }
--   { "connection": { ... } }   -- later, no migration
--   { "campaign":   { ... } }   -- later, no migration
--
-- The API accepts ONLY the context namespace today. A future namespace is a
-- deliberate addition there, not something a client can invent.
--
-- NO INDEX, DELIBERATELY. A GIN index on jsonb costs write throughput and
-- storage on every insert, and these two tables take a row on every card view
-- on the platform. We do not yet know the event volume, the query patterns, or
-- which metadata fields will actually be queried at scale. An index added now
-- would be a guess paid for on every future page view. Add targeted ones later
-- against real analytics queries.
--
-- NO RLS CHANGE REQUIRED, and that was checked rather than assumed. The insert
-- policy on both tables is `with check (true)` for anon and authenticated, and
-- the select policy is an ownership `exists` subquery. Neither enumerates
-- columns, so a new column is covered by the existing policies with no edit.
--
-- THE READ PATH IS ALSO SAFE, also checked. The analytics dashboard selects
-- named columns, not select('*'), so it simply will not see this one and
-- cannot break on it. The account data export DOES use select('*'), which
-- means metadata will appear in a user's own export - correct behaviour, and
-- the reason the API refuses to store anything personal in it.

alter table public.card_events
  add column if not exists metadata jsonb;

alter table public.team_card_events
  add column if not exists metadata jsonb;

comment on column public.card_events.metadata is
  'Optional namespaced attribution for an event, e.g. {"context":{"audience":"it","source":"sender","version":1}}. Written only by /api/analytics, which validates against an allow-list and refuses personal data. Null on every event that predates migration 080.';

comment on column public.team_card_events.metadata is
  'Optional namespaced attribution for an event. Mirrors card_events.metadata; see that comment.';

-- Proof, in the result pane. Both must return true.
select
  (select count(*) = 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'card_events' and column_name = 'metadata'
       and data_type = 'jsonb' and is_nullable = 'YES') as card_events_ok,
  (select count(*) = 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'team_card_events' and column_name = 'metadata'
       and data_type = 'jsonb' and is_nullable = 'YES') as team_card_events_ok;
