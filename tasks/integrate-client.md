# Integrate apps/client with Keycloak auth + PowerSync sync

## Goal

Close the loop on the local-first architecture: today `apps/client` is a bare
Vite + React + TanStack Router + PWA scaffold with no login and no data - the
entire stack behind it (domain model, Postgres + RLS, Keycloak, PowerSync,
apps/server) is built and verified, but only from the server side down. This
task wires the browser up to it: real login against Keycloak, real local-first
sync against PowerSync, real writes flowing back to Postgres.

**Read `docs/data-model.md` first**, especially "Auth: Keycloak + apps/server"
and "Postgres RLS for multi-tenancy" - this task builds directly on both.
**Also read the `powersync` skill** (`references/sdks/powersync-js-react.md`
and `references/sdks/powersync-js.md` at minimum) before writing any
PowerSync client code - it has the exact Vite config, connector interface,
and gotchas (e.g. `connect()` is fire-and-forget, `transaction.complete()` is
mandatory, a 4xx from `uploadData` blocks the upload queue permanently).

## What's already ready (built and verified this session)

- Domain model as Effect Schema (`packages/schema`), Drizzle bridge with a
  drift test (`packages/db`).
- Self-hosted Postgres with RLS enabled on every host-scoped table
  (`packages/db/src/rls.ts`), a non-owner `app_user` role apps/server queries
  through, and `apps/server/src/HostScopedDb.ts` setting `app.host_id` per
  request.
- Self-hosted Keycloak (`docker-compose.yml`'s `keycloak` service,
  `keycloak/realm-export.json`) issuing JWTs with a `host_id` claim and a
  `powersync-dev` audience.
- Self-hosted PowerSync (`docker-compose.yml`'s `powersync`/`pg-storage`
  services, `powersync/sync-config.yaml`'s Sync Streams) with a least-
  privilege replication role, and `client_auth` pointed at Keycloak's JWKS.
- `apps/server`: `GET /health` (public), `GET /me` (protected, returns JWT
  claims), `GET /hosts/me` (protected, real Postgres query through
  `HostScopedDb` - proves RLS end-to-end).
- The `effective-app-client` Keycloak client already has
  `standardFlowEnabled: true` and a redirect URI matching Vite's default dev
  port (`http://localhost:5173/*`) - ready for a real browser login flow, not
  just the password-grant curl calls used for backend testing so far.

## What remains

Roughly in dependency order:

1. **Decide the login flow and token storage approach** (see "Open decisions"
   below) - blocks everything else.
2. **Add an OIDC login flow to `apps/client`** - Authorization Code + PKCE
   against Keycloak (`effective-app-client`, `standardFlowEnabled`), a login
   route, a logout action, and a route guard so unauthenticated users can't
   reach data routes. `directAccessGrantsEnabled` (password grant) on the
   Keycloak client exists only for backend testing - don't use it from the
   browser.
3. **Add a write/upload endpoint to `apps/server`** - PowerSync's client
   connector calls `uploadData()`, which needs a real backend endpoint to
   apply the batch of local writes to Postgres. This doesn't exist yet
   (`apps/server` is currently read-only: `/health`, `/me`, `/hosts/me`).
   Route it through `HostScopedDb` like every other query, so RLS still
   applies to writes. Per the PowerSync skill: apply operations
   synchronously, return 2xx even for validation errors (a 4xx permanently
   blocks the upload queue) - `custom-backend.md`'s "Backend API for
   uploadData" section has the exact contract.
4. **Add CORS to `apps/server`** - the browser will call it cross-origin
   (`localhost:5173` → `localhost:3000`); nothing configures this yet.
5. **Define the PowerSync client-side schema** - PowerSync's JS SDK needs an
   explicit local SQLite schema (tables/columns, `column.text`/
   `column.integer` only, no defined `id` column - PowerSync adds it). This
   needs to cover the same 12 entities `powersync/sync-config.yaml` streams.
   Open question: hand-write it (mirroring how `packages/db`'s Drizzle tables
   are hand-written against `packages/schema`, plus a drift test) or generate
   it - decide explicitly, don't default silently (same framing as the
   original "Effect Schema → Drizzle bridge" decision in
   `tasks/implement-domain-model.md`).
6. **Wire the PowerSync client SDK into `apps/client`** - install
   `@powersync/web` (browser/PWA target, not `@powersync/react-native`), the
   Vite config changes `powersync-js-react.md` calls out
   (`optimizeDeps.exclude`, `worker.format: 'es'`) - do this *before*
   installing packages, per the skill - and a `PowerSyncBackendConnector`
   implementing `fetchCredentials()` (current Keycloak access token + the
   PowerSync sync endpoint URL) and `uploadData()` (posts to the new
   apps/server endpoint from step 3).
7. **Verify the full loop live**: log in through the real browser flow, see
   the logged-in host's data appear (synced from Postgres through PowerSync
   into local SQLite), make a write in the UI, confirm it lands in Postgres
   (and that RLS still scoped it correctly), and confirm a change made
   directly in Postgres shows up in the client without a page reload.

## Open decisions to resolve first

- **Token storage in the browser**: in-memory only (safest, but loses the
  session on refresh unless paired with silent-refresh-via-iframe or a
  refresh token flow) vs. persisted (localStorage/IndexedDB, simpler, more
  exposure if XSS occurs). Pick one explicitly and document why - this is
  security-relevant (OWASP token-handling), not a detail to default silently.
- **OIDC client library**: e.g. `oidc-client-ts` (mature, framework-agnostic)
  vs. a thinner hand-rolled PKCE flow. Check what's already common in this
  kind of Vite + TanStack Router setup before adding a dependency.
- **PowerSync client schema strategy** (see step 5 above).

## Testing

`apps/client` has no test runner wired up yet (no `vitest` devDependency, no
`test` script) - per `AGENTS.md`, every app needs to be independently
testable via swappable `Layer`/service boundaries. At minimum, decide and set
up:

- Unit tests for the `PowerSyncBackendConnector`'s `fetchCredentials`/
  `uploadData` logic (fake token provider, fake fetch - no real network).
- Unit tests for the new `apps/server` upload endpoint (fake `HostScopedDb`,
  per the existing pattern in `apps/server/src/JwtVerifier.test.ts`).

## Out of scope

- Multi-location/franchise structure (already deferred, see
  `docs/data-model.md`).
- Building out real business-logic FSD packages (`packages/entities`/
  `features`/`widgets`) - this task only needs enough UI to prove the
  login+sync loop, not a real feature.
- Production-grade auth hardening (BFF/backend-for-frontend token handling,
  refresh token rotation policies) - note the tradeoff, don't necessarily
  build it, this is still a PoC.

## References

- [`docs/data-model.md`](../docs/data-model.md) - "Auth: Keycloak +
  apps/server", "Postgres RLS for multi-tenancy", "PowerSync sync streams"
- The `powersync` skill (`references/sdks/powersync-js-react.md`,
  `references/sdks/powersync-js.md`, `references/custom-backend.md`,
  `references/powersync-debug.md`)
- `apps/server/src/JwtVerifier.ts`/`Auth.ts`/`HostScopedDb.ts` - the patterns
  (swappable Layers, no real network/DB in unit tests) to mirror on the
  client side
- `keycloak/realm-export.json` - `effective-app-client`'s existing
  `standardFlowEnabled`/redirect URI config
