# Integrate apps/client with Keycloak auth + PowerSync sync

> **Pre-reset context:** this task was written against `apps/client`,
> `apps/server`, and the Keycloak/PowerSync/Postgres-RLS stack described
> below as "already ready" - all of that was scrapped in the 2026-07-22
> clean-slate reset (see `docs/roadmap.md`). Nothing in this file exists
> right now: `apps/client`/`apps/server` are gone, `infra/keycloak` and
> `infra/powersync` are empty placeholder directories (no realm export, no
> sync config), and `docs/data-model.md` was deleted. This task is blocked
> until the domain model (`docs/implement-domain-model.md`), `apps/server`,
> and the self-hosted Keycloak/PowerSync infra are rebuilt from scratch. The
> steps below are kept as a reference for what this integration will
> eventually need to cover, not a ready-to-start plan.

## Goal

Close the loop on the local-first architecture: once `apps/client` exists
again, wire the browser up to real login against Keycloak, real local-first
sync against PowerSync, and real writes flowing back to Postgres.

**Read the `powersync` skill** (`references/sdks/powersync-js-react.md` and
`references/sdks/powersync-js.md` at minimum) before writing any PowerSync
client code - it has the exact Vite config, connector interface, and gotchas
(e.g. `connect()` is fire-and-forget, `transaction.complete()` is mandatory, a
4xx from `uploadData` blocks the upload queue permanently).

## Prerequisites (none of this exists yet)

- Domain model as Effect Schema (see `docs/implement-domain-model.md`), plus
  a Drizzle bridge with a drift test.
- Self-hosted Postgres with RLS enabled on every host-scoped table, a
  non-owner query role, and per-request tenant scoping (`app.host_id` or
  equivalent) in `apps/server`.
- Self-hosted Keycloak (a `docker-compose.yml` service + a populated
  `infra/keycloak/realm-export.json`) issuing JWTs with a tenant claim and a
  PowerSync-scoped audience.
- Self-hosted PowerSync (`docker-compose.yml` service(s) + a populated
  `infra/powersync/sync-config.yaml`) with a least-privilege replication role
  and `client_auth` pointed at Keycloak's JWKS.
- `apps/server` endpoints for at least an authenticated health/whoami check
  and one real tenant-scoped read, proving RLS end-to-end.
- A Keycloak client for the browser app with the auth flow enabled and a
  redirect URI matching the dev server's port.

## What remains once the prerequisites exist

Roughly in dependency order:

1. **Decide the login flow and token storage approach** (see "Open decisions"
   below) - blocks everything else.
2. **Add an OIDC login flow to `apps/client`** - Authorization Code + PKCE
   against Keycloak, a login route, a logout action, and a route guard so
   unauthenticated users can't reach data routes. Password-grant flows, if
   enabled on the Keycloak client for backend testing, must never be used
   from the browser.
3. **Add a write/upload endpoint to `apps/server`** - PowerSync's client
   connector calls `uploadData()`, which needs a real backend endpoint to
   apply the batch of local writes to Postgres. Route it through the same
   tenant-scoped query path as reads, so RLS still applies to writes. Per the
   PowerSync skill: apply operations synchronously, return 2xx even for
   validation errors (a 4xx permanently blocks the upload queue) -
   `custom-backend.md`'s "Backend API for uploadData" section has the exact
   contract.
4. **Add CORS to `apps/server`** - the browser will call it cross-origin.
5. **Define the PowerSync client-side schema** - PowerSync's JS SDK needs an
   explicit local SQLite schema (tables/columns, `column.text`/
   `column.integer` only, no defined `id` column - PowerSync adds it),
   covering the same entities `infra/powersync/sync-config.yaml` streams.
   Open question: hand-write it (mirroring the Drizzle-vs-Effect-Schema drift
   test approach) or generate it - decide explicitly, don't default silently
   (same framing as the "Effect Schema → Drizzle bridge" decision in
   `docs/implement-domain-model.md`).
6. **Wire the PowerSync client SDK into `apps/client`** - install
   `@powersync/web` (browser/PWA target, not `@powersync/react-native`), the
   Vite config changes `powersync-js-react.md` calls out
   (`optimizeDeps.exclude`, `worker.format: 'es'`) - do this _before_
   installing packages, per the skill - and a `PowerSyncBackendConnector`
   implementing `fetchCredentials()` (current Keycloak access token + the
   PowerSync sync endpoint URL) and `uploadData()` (posts to the new
   apps/server endpoint from step 3).
7. **Verify the full loop live**: log in through the real browser flow, see
   the logged-in tenant's data appear (synced from Postgres through
   PowerSync into local SQLite), make a write in the UI, confirm it lands in
   Postgres (and that RLS still scoped it correctly), and confirm a change
   made directly in Postgres shows up in the client without a page reload.

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

Per `AGENTS.md`, every app needs to be independently testable via swappable
`Layer`/service boundaries. At minimum, decide and set up:

- Unit tests for the `PowerSyncBackendConnector`'s `fetchCredentials`/
  `uploadData` logic (fake token provider, fake fetch - no real network).
- Unit tests for the new `apps/server` upload endpoint (fake DB layer, no
  real network/DB).

## Out of scope

- Multi-location/franchise structure - deferred in the deleted
  `docs/data-model.md`; re-confirm this deferral still holds once the model
  is redesigned.
- Building out real business-logic packages beyond what proves the
  login+sync loop - this task only needs enough UI for that, not a full
  feature.
- Production-grade auth hardening (BFF/backend-for-frontend token handling,
  refresh token rotation policies) - note the tradeoff, don't necessarily
  build it, this is still a PoC.

## References

- [`docs/implement-domain-model.md`](implement-domain-model.md) - the
  domain model this integration depends on
- [`docs/roadmap.md`](roadmap.md) - what was reset and why
- The `powersync` skill (`references/sdks/powersync-js-react.md`,
  `references/sdks/powersync-js.md`, `references/custom-backend.md`,
  `references/powersync-debug.md`)
- `infra/keycloak/`, `infra/powersync/` - currently empty placeholders for
  the self-hosted Keycloak realm export and PowerSync sync config once
  rebuilt
