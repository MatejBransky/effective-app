-- Least-privilege role for PowerSync's replication connection (see
-- docs/data-model.md's "PowerSync sync streams" section) - REPLICATION + read-only,
-- not the `effective_app` superuser that owns the tables and creates the publication
-- (01-powersync-publication.sql still runs as `effective_app`, since CREATE PUBLICATION
-- needs table ownership/superuser - only the ongoing replication connection changes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'powersync_replication') THEN
    CREATE ROLE powersync_replication WITH LOGIN PASSWORD 'local_dev_only' REPLICATION NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE effective_app TO powersync_replication;
GRANT USAGE ON SCHEMA public TO powersync_replication;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_replication;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_replication;
