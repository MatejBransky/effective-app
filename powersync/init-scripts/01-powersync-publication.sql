-- PowerSync's logical replication connection needs a Postgres publication to read
-- from. `FOR ALL TABLES` is the simplest option for a PoC - a production setup would
-- scope this to just the tables referenced in sync-config.yaml, and use a dedicated
-- replication-only role instead of reusing the app's own `effective_app` user (see
-- docs/data-model.md's "PowerSync sync streams" section for both deferred items).
--
-- Only runs on first container start (empty volume) - see docker-compose.yml's comment
-- on the `postgres` service for how to force it to re-run.
CREATE PUBLICATION powersync FOR ALL TABLES;
