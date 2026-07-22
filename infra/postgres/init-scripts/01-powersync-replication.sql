-- Least-privilege role for PowerSync's replication connection (self-hosted, Phase 3 of
-- docs/powersync-setup.md) - read-only + REPLICATION, never the `effective_app`
-- table-owner role. Local dev only, hence the plaintext password (consistent with
-- POSTGRES_PASSWORD/KEYCLOAK_ADMIN_PASSWORD in docker-compose.yml).
CREATE USER powersync_replication WITH REPLICATION PASSWORD 'local_dev_only';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_replication;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_replication;

-- No domain model/tables exist yet (see docs/roadmap.md's "Reset" section) - replicate
-- everything for now; narrow this to specific tables once a domain model exists.
CREATE PUBLICATION powersync FOR ALL TABLES;
