-- Non-owner role apps/server connects as for its runtime queries (see
-- docs/data-model.md's "Postgres RLS for multi-tenancy" section). `effective_app`
-- (POSTGRES_USER above) owns every table via drizzle-kit migrations, and Postgres
-- lets table owners bypass RLS by default - so the app's own request-handling
-- connection must be a different, non-superuser, non-owner role for RLS policies to
-- actually apply. Grants (not ownership) are what let this role read/write the tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'local_dev_only' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE effective_app TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- Applies the same grants to tables created by future migrations automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
