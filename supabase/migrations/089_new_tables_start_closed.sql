-- Migration 089: new tables start closed, from today rather than 30 October.
--
-- WHAT SUPABASE IS CHANGING. On 30 October 2026 Supabase stops granting Data
-- API access automatically to new tables in the public schema. Existing tables
-- keep every grant they have, so nothing in production breaks on the day. What
-- changes is that a table created afterwards starts with NO grants - to anon,
-- to authenticated, and to service_role - until a migration grants them.
--
-- WHY THAT SUITS CARDTLY, AND WHY THE GAP UNTIL THEN DOES NOT. Migrations 083
-- to 085 were written because the old default was the problem: every table in
-- public was readable and writable by the anon and authenticated roles unless
-- someone remembered to revoke it, and before 083 exactly one REVOKE existed in
-- this repository. 085 closed writes on every table that existed when it ran,
-- by reading the catalogue - but it could only reach tables that already
-- existed. It never touched DEFAULT PRIVILEGES, so the next table created,
-- whether by a migration or in the dashboard's table editor (card_events was
-- made there), is born with full write access for anon and authenticated.
-- Supabase is about to fix that for us in five weeks. This closes the window
-- now.
--
-- WHAT THIS DOES NOT DO: touch service_role. After 30 October Supabase stops
-- default-granting it too, and every Cardtly server route that uses the admin
-- client needs it. Rather than lean on a default Supabase is about to remove,
-- scripts/check-migration-grants.mjs requires every new table's migration to
-- grant service_role EXPLICITLY. A default we set here could be undone by
-- theirs on the day; a grant written into the migration cannot.
--
-- Tables only. Sequences and functions keep their current defaults: a new
-- table's sequence is useless to a role with no grant on the table, and the
-- Supabase change is about tables.
--
-- EXISTING TABLES ARE NOT AFFECTED. Default privileges apply only to objects
-- created after this runs.
--
-- NO BEGIN/ROLLBACK DRY RUN IN HERE, deliberately. The SQL editor sends this
-- whole file as one batch, and Postgres runs a batch as one transaction: a
-- ROLLBACK at the end of a "create a probe table, look at it, roll back" proof
-- would roll back the ALTER above it too, and report a perfect result for a
-- migration that had not been applied. The proof below only reads.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- Proof. Every default grant that a NEW table created by postgres will be
-- born with, in the public schema and globally.
--
-- Expected: rows whose default_grants mention postgres and service_role, and
-- NOT ONE containing "anon=" or "authenticated=".
--
-- If a row with schema "(all schemas)" still shows anon= or authenticated=,
-- Supabase set that default globally rather than per schema, which a
-- per-schema revoke cannot remove. Send the result back and it gets a
-- follow-up rather than a guess.
select pg_get_userbyid(d.defaclrole)          as creator,
       coalesce(n.nspname, '(all schemas)')   as schema,
       d.defaclacl                            as default_grants
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
 where d.defaclobjtype = 'r'
   and (n.nspname = 'public' or d.defaclnamespace = 0)
 order by creator, schema;
