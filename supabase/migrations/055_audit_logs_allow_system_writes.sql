-- Let a server-side write into an audited table succeed.
--
-- audit_logs and its triggers were created outside this repo, alongside the
-- webhooks / api_keys / crm_integrations tables. The trigger records
-- auth.uid() into audit_logs.user_id, which is NOT NULL - and auth.uid() is
-- null for anything done with the service-role key, because there is no end
-- user in that connection.
--
-- The effect: inserting a row into webhooks or api_keys from a route handler
-- fails with
--
--   null value in column "user_id" of relation "audit_logs"
--
-- which surfaces to the customer as an opaque save failure. Both integration
-- features are unusable until this runs.
--
-- Making the column nullable rather than defaulting it to some placeholder
-- user: a write made by the system genuinely has no person behind it, and
-- recording a made-up one would put a false name against a real change in an
-- audit trail. The rest of the row - the table, the action, the values, the
-- timestamp - is still captured either way.

alter table audit_logs
  alter column user_id drop not null;

comment on column audit_logs.user_id is
  'Who made the change. NULL for a change made by the server itself, where there is no signed-in user - a webhook delivery, a cron, or a route acting with the service role.';
