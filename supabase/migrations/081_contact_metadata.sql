-- Migration 081: a generic metadata column on contacts
--
-- ADDITIVE ONLY. One nullable column, no default, no backfill, no index.
-- Existing contacts read back with metadata null.
--
-- WHY NOT contacts.answers, which already exists and is jsonb. Because it is
-- an ARRAY with a specific established meaning - things the visitor typed:
--
--   [{"label":"Service Needed","value":"Web Design"}]
--
-- and three separate pieces of Cardtly already consume it that way: the
-- Contacts card renders each entry as a label and value, the CSV export folds
-- them into a "responses" column, and the lead notification email prints them
-- under the heading "Their answers". Appending a synthetic
-- {"label":"Context","value":"IT"} would surface Cardtly system data in all
-- three places as though the visitor had written it, and would contaminate a
-- CSV column customers already use.
--
-- There is no other jsonb column on contacts, so this is a new one.
--
-- GENERIC, NOT CONTEXT-SPECIFIC, for the same reason as migration 080 on the
-- event tables: Connections, Smart Handoff and relationship attribution will
-- each want structured data on a contact, and a namespaced payload means none
-- of them needs another migration. Only the `context` namespace is written
-- today, and the API accepts only that.
--
-- RLS is untouched: the policies on contacts do not enumerate columns.

alter table public.contacts
  add column if not exists metadata jsonb;

comment on column public.contacts.metadata is
  'Optional namespaced structured data about a contact, e.g. {"context":{"selectedAudience":"it","selectedLabel":"IT","activeAudience":"it","activeSource":"visitor","version":1}}. NOT questionnaire answers - those are contacts.answers, which is an array of what the visitor typed. selectedAudience is present only when the visitor personally chose it; a sender or default Context records activeAudience alone, because an assumption must not become a stated fact about a person.';

-- Proof. Expect true.
select count(*) = 1 as contacts_metadata_ok
from information_schema.columns
where table_schema = 'public' and table_name = 'contacts'
  and column_name = 'metadata' and data_type = 'jsonb' and is_nullable = 'YES';
