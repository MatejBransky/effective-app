# PowerSync setup for apps/web

## Decisions made (2026-07-22)

- **Platform:** dual-environment, deliberately.
  - **Local dev:** self-hosted PowerSync via Docker, joining the existing
    `docker-compose.yml` stack (Postgres, mailpit) - no external dependency,
    fully offline-capable, matches how this repo already runs local infra
    (`pnpm dev:infra`).
  - **Production:** PowerSync Cloud, **free plan**, to get a full deployed
    version of the app running end-to-end. This is a later phase, blocked on
    the app actually having a deployable production Postgres + auth endpoint
    (see "Later: Production (PowerSync Cloud)" below) - not detailed step by
    step yet.
  - **Why not Cloud for local dev too:** Cloud is an externally-hosted
    service - it would need network access to a local Postgres and Keycloak,
    which aren't publicly reachable. Self-hosted keeps everything in the same
    Docker network with no tunneling/exposure needed. See the "why" discussion
    earlier in this conversation for the full reasoning.
- **Source database:** our own Postgres (`infra/postgres`, already running via
  `docker-compose.yml`), not Supabase.
- **Backend API:** none exists yet - `apps/` currently only has `apps/web`
  (the Vite/React frontend). A new backend app needs to be built.
- **Client auth:** Keycloak. `infra/keycloak/realm-export.json` is currently an
  empty placeholder and Keycloak isn't wired into `docker-compose.yml` at all
  yet - this is the first real piece of work (Phase 0).

This resolves the earlier conflict with `docs/integrate-client.md`'s
prerequisites (which assumed self-hosted PowerSync): for local dev they now
agree. That document doesn't cover a production Cloud deploy at all - treat
"Later: Production" below as new scope, not something it already accounts for.

**Read the `powersync` skill** (`AGENTS.md`, then
`references/onboarding-custom.md`, `references/custom-backend.md`, and
`references/powersync-cli.md` § "Self-Hosted Usage") before starting any
phase below - it has the mandatory ask-first rules, exact CLI commands, and
JWT/JWKS/upload-endpoint contracts referenced here.

## Why this order

Per the PowerSync skill's onboarding playbook: **backend and auth readiness
before any client code.** Concretely: PowerSync's `client_auth` needs a real
JWKS URI to verify tokens against, so Keycloak has to exist before PowerSync
service config can be finished; the backend's `uploadData` endpoint has to
exist before `apps/web` can wire up a connector; and none of this is
verifiable end-to-end until the Postgres replication/publication side is set
up too.

## Phase 0 - Auth (Keycloak, local) — next session starts here

1. Add a Keycloak service to `docker-compose.yml` (image, port, admin
   credentials via `.env`, following the same "avoid default/common local
   ports" pattern already used for Postgres/mailpit).
2. Create/configure a realm + client so issued JWTs carry an `aud` claim that
   will match PowerSync's `service.yaml` `client_auth.audience`.
3. Confirm the realm's JWKS URL is reachable from the PowerSync container -
   from inside Docker this is the Keycloak service's container name/network
   alias, not `localhost` (self-hosted service.yaml § "Complete service.yaml
   Example" / `custom-backend.md`'s `block_local_jwks` note apply here). This
   replaces the custom JWT-signing code in `references/custom-backend.md`
   entirely; Keycloak is both the token issuer and the JWKS provider.
4. Populate `infra/keycloak/realm-export.json` for real (currently an empty
   placeholder dir) so the realm config is reproducible/committed.

## Phase 1 - Source database (Postgres)

5. Set up logical replication / a publication on the existing Postgres
   instance (`infra/postgres`) for PowerSync's CDC - exact SQL to be pulled
   from `references/powersync-service.md` § "Source Database Setup" when this
   phase starts.
6. Write `PS_DATA_SOURCE_URI` to `.env` (self-hosted's variable name - not
   `PS_DATABASE_URI`, which is the Cloud one used later in production).

## Phase 2 - Backend API (new app)

7. Add a new app (e.g. `apps/server`) with, at minimum:
   - An `uploadData` endpoint receiving `CrudEntry[]`, writing to Postgres
     **synchronously**, always returning 2xx (a 4xx permanently blocks the
     client's upload queue - see `references/custom-backend.md` § "Backend
     API for uploadData").
   - Verification of incoming requests against Keycloak's JWKS. No separate
     `/token` endpoint is needed - Keycloak issues tokens to the browser
     directly.
8. Add CORS for `apps/web`'s origin.

## Phase 3 - PowerSync self-hosted instance (local dev)

9. `powersync init self-hosted` → `powersync docker configure` (use
   `--database external` to point at the existing `infra/postgres` instance
   instead of provisioning a new one) → `powersync docker start`.
10. `service.yaml`: `client_auth.jwks_uri` → Keycloak's JWKS URL (container
    network address), `audience` matching what Keycloak signs, plus a
    `storage` block (self-hosted needs its own bucket-storage DB - Postgres
    or MongoDB - unlike Cloud, which manages this for you) and `api.tokens`
    for `PS_ADMIN_TOKEN`.
11. `sync-config.yaml`: Sync Streams (`config: edition: 3`) over the Postgres
    tables that need to sync.
12. `powersync docker reset` to pick up config changes. Verify with
    `powersync status` / `powersync validate`.

## Readiness gate (before touching apps/web)

- [ ] Postgres publication/replication set up
- [ ] Keycloak realm + JWKS reachable from the PowerSync container
- [ ] Backend API running (upload endpoint)
- [ ] PowerSync self-hosted instance up (`powersync docker start`),
      `client_auth` + `storage` configured
- [ ] All credentials/URLs in `.env`

## Phase 4 - apps/web integration (only after the gate above)

13. `pnpm add @powersync/web@latest @journeyapps/wa-sqlite@latest` in
    `apps/web`, plus the Vite config changes from
    `references/sdks/powersync-js-react.md` (`optimizeDeps.exclude`,
    `worker.format: 'es'`) - apply these **before** installing the packages.
14. `powersync generate schema --output=ts --output-path=./src/schema.ts` (or
    hand-write it - never define the `id` column, PowerSync adds it
    automatically).
15. Implement a `PowerSyncBackendConnector`: `fetchCredentials()` (Keycloak
    access token + the PowerSync instance URL) and `uploadData()` (posts to
    the Phase 2 endpoint). `transaction.complete()` is mandatory or the queue
    stalls permanently.
16. Initialize PowerSync and connect. `connect()` is fire-and-forget - use
    `waitForFirstSync()` if readiness matters. Use `disconnectAndClear()` on
    logout/user switch.
17. Verify the full loop live: log in via Keycloak, see Postgres data appear
    in the local SQLite store, make a write in the UI, confirm it lands in
    Postgres, confirm a direct Postgres change shows up in the client without
    a reload.

## Later: Production (PowerSync Cloud)

Not detailed yet - revisit once the app has a real deployed target (this
repo's roadmap mentions a Cloudflare/Alchemy IaC deploy path that was reset;
see `docs/roadmap.md`). At minimum this will need:

- A production Postgres reachable from PowerSync Cloud's servers (public
  endpoint or an AWS PrivateLink Private Endpoint if going through that path -
  Team/Enterprise only, so likely not applicable on a free plan).
- A production Keycloak (or other auth) deployment whose JWKS URL is
  similarly publicly reachable - the local Keycloak instance from Phase 0
  cannot serve this.
- Confirm what the **free plan** actually includes/limits before relying on
  it (instance count, replicas, uptime) - don't assume parity with paid
  plans; check `https://www.powersync.com/pricing` or the dashboard when this
  phase starts.
- A **separate** PowerSync config directory for this environment (`powersync
  init cloud` in e.g. `powersync-cloud/`, keeping the self-hosted `powersync/`
  directory from Phase 3 untouched) - see `references/powersync-cli.md` §
  "Multi-Environment Setup" for the `--directory` pattern. Do not point the
  same CLI-managed directory at both a self-hosted stack and a Cloud
  instance.
- Otherwise the same shape as Phase 3 (steps 9-12), using
  `powersync init cloud` / `powersync link cloud --create` /
  `powersync deploy` instead of the `docker` subcommands.

## Open decisions (resolve when reached, don't default silently)

- **Token storage in the browser**: in-memory only vs. persisted
  (localStorage/IndexedDB) - security-relevant (OWASP token handling), pick
  explicitly.
- **OIDC client library**: `oidc-client-ts` vs. a thinner hand-rolled PKCE
  flow.
- **PowerSync client schema strategy**: generate via CLI vs. hand-write.
- **Production Keycloak/Postgres hosting**: where these actually get deployed
  is unresolved - depends on whatever replaces the reset
  `apps/infrastructure` (see `docs/roadmap.md`).

## References

- The `powersync` skill: `AGENTS.md`, `references/onboarding-custom.md`,
  `references/custom-backend.md`, `references/powersync-service.md`,
  `references/sync-config.md`, `references/powersync-cli.md`,
  `references/sdks/powersync-js.md`, `references/sdks/powersync-js-react.md`,
  `references/powersync-debug.md`
- [`docs/integrate-client.md`](integrate-client.md) - overlapping prior
  write-up; its self-hosted assumption now matches this file's local-dev
  path (see "Decisions made" above)
- [`docs/roadmap.md`](roadmap.md) - what was reset and why, including the
  Cloudflare/Alchemy deploy path production PowerSync Cloud will depend on
- [`apps/web`](../apps/web) - the frontend this will eventually integrate
  with (Phase 4)
- `infra/keycloak/`, `infra/postgres/` - currently empty placeholder
  directories for the Keycloak realm export and Postgres init scripts
