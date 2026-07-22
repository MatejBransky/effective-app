# Roadmap - what's left to make this boilerplate "complete"

This is the higher-level index of remaining initiatives.

## Reset (2026-07-22)

The previous domain model, `apps/client`, `apps/server`, `apps/infrastructure`,
`shared/app-shell`, and `shared/entities` (including its Postgres RLS/Keycloak/
PowerSync setup) were intentionally scrapped to start those over - see git
history before this point for the prior implementation if any of it is worth
referencing. The layer architecture (`apps/*`, `domains/*`, `shared/*`,
`scripts`) and the chosen technologies (Effect, effect v4, React, Drizzle +
Postgres, TanStack Router, Alchemy IaC) stay as the intended direction; only
the concrete implementation built on top of them is gone.

## Done

- **Keycloak (self-hosted, local dev)** - `docker-compose.yml`'s `keycloak` service +
  `infra/keycloak/realm-export.json`. Deliberately generic (no tenant/business claim
  yet - see `CONTEXT.md`). Phase 0 of `docs/powersync-setup.md`.
- **`apps/server` (skeleton)** - Effect v4 HTTP API (`effect/unstable/httpapi`) with a
  public `/health` and a Keycloak-JWT-protected `/me` endpoint, verified end-to-end
  against the live Keycloak. The `uploadData`/tenant-scoped endpoints Phase 2 also
  calls for still wait on a domain model existing.
- **`apps/web` Keycloak login** - Authorization Code + PKCE (`oidc-client-ts`),
  in-memory token storage with hidden-iframe silent renew, `@tanstack/react-router`
  (first use in this repo). Calls `apps/server`'s `/me` with the resulting token,
  proving the full browser -> Keycloak -> apps/server chain live in the browser.
- **`CONTEXT.md`** - business glossary started (Host/Member/Lead/Admin), referenced
  from `AGENTS.md`.
- **Postgres logical replication (Phase 1 of `docs/powersync-setup.md`)** -
  `wal_level=logical`, the least-privilege `powersync_replication` role, and a
  `FOR ALL TABLES` publication (`infra/postgres/init-scripts/01-powersync-
replication.sql`) - `PS_DATA_SOURCE_URI` in `.env`.
- **Self-hosted PowerSync instance (Phase 3)** - `infra/powersync/` (CLI-managed:
  `powersync init self-hosted` + `docker configure` + `docker start`), `client_auth`
  wired to Keycloak's JWKS over the shared Docker network, verified replicating
  against `infra/postgres` with 0 bytes lag. `sync-config.yaml` is deliberately
  `streams: {}` - no domain model to sync yet.

See `docs/powersync-setup.md` for the full phase breakdown and exactly what's still
blocked (its own checklist is the source of truth, not this list).

## In progress

Nothing actively in progress. `docs/powersync-setup.md`'s readiness gate is mostly
green, but one item blocks Phase 4 (`apps/web` PowerSync client integration): the
backend's `uploadData` endpoint doesn't exist yet, and that in turn waits on a
domain model existing (see "Done" above - `apps/server`'s `/health`/`/me` prove the
JWKS verification chain, not the data path). A domain model has to come before
Phase 4 can start.

## Design doc: apps/web Effect bootstrap (app shell + cross-domain actions)

`docs/web-bootstrap-architecture.md` - how `apps/web`'s bootstrap should
compose domain `Layer`s (via `Layer.mergeAll` + `Atom.runtime`), a
`shared/shell` package for global modal/sidebar management (`ShellUI.openSidebar`/
`openModal`, mirroring the legacy `openModal((resolve) => jsx)` pattern on top
of `Effect.callback`), and the `shared/entities`-tag convention for
cross-domain action calls.

Iteration 1 (bootstrap skeleton - Effect DI wiring + static navbar, zero
business logic) is done: `apps/web/src/runtime/MainLayer.ts` + `runtime.ts`
(`Atom.runtime(MainLayer)`), `main.tsx` wraps `RouterProvider` in
`@effect/atom-react`'s `RegistryProvider`, and a static `Navbar` mounts in
`__root.tsx`.

Iteration 2 (sidebar management) is done: `shared/shell`
(`@repo/shared-shell`) - `ShellUI.openSidebar` (`Effect.callback` + a
`SubscriptionRef` stack; one explicit method per overlay kind rather than a
single `open(render, { kind? })` - an optional `kind` with a silent default
reads ambiguously at the call site), `ShellHost` (runtime-agnostic, takes the
bridged state atom as a prop), `useShellUI` (dispatches via the app's own
`runtime.fn`, generic over which `open*` atom it's given). `ShellUI`'s `make`
effect is passed inline via `Context.Service`'s `make` option, with a
`static readonly layer` on the class itself - mirrors `MemoryDriver` in
`externals/effect/packages/effect/src/unstable/cluster/MessageStorage.ts`
rather than a separately exported `layer` const. `MainLayer` now merges
`ShellUI.layer`; the Navbar's "Menu" button opens a sidebar purely to prove
the open/resolve round trip - scaffolding, not a real feature.

The rest of the design (the `shared/entities`-tag cross-domain action
convention, a `kind: "modal"` example) is still design-only - unblocked to
build once a first real domain exists (see `docs/implement-domain-model.md`).

## New idea from a previous conversation: scheduled/async jobs example

A concrete example of a scheduled/background job (Effect `Schedule` or
similar) that:

- Runs locally during dev without needing any external/online service.
- Also runs after deployment to Cloudflare (Cron Triggers or Queues,
  whichever fits) - the point is proving **local/cloud parity**: the same
  logic works in both places, not two different implementations.

This depends on `apps/infrastructure` existing first (nothing to deploy to
Cloudflare and verify parity against until then).

## Exploratory - needs a dedicated design conversation before it's a real task

These two are related (the second depends on the first) but neither is
concretely scoped yet - don't start building against guesses. Flagged here
so they aren't lost, not as ready-to-implement plans.

### AI communication prep (general capability)

`AGENTS.md`/`README.md` both call this app "AI-agent-controllable" without
saying what that means technically. Candidates discussed previously: an MCP
server exposing `apps/server`'s capabilities as tools, vs. just making sure
`HttpApi` contracts/error types/docs are clean enough for any agent to code
against directly. Revisit before starting the item below, since it depends
on this being resolved first.

### Customer-facing "AI proposes a PoC feature" playground

The actual product idea (not yet a technical plan): let a **customer**,
after logging in, describe a feature they want in a "playground" area of
the app. **Their own AI coding agent** (Claude Code, Gemini, ChatGPT,
opencode, etc. - explicitly **bring-your-own**, not a vendor-hosted AI
integration we'd be paying for on the customer's behalf) reads this app's
docs/API and implements a PoC, opening a PR in our repo. One of our
developers then reviews it - merges, refines, or pushes back. The goal:
the customer gets to validate their own idea with a working PoC _before_
formally requesting it from the dev team, instead of us building things
customers turn out not to actually want.

Open questions to resolve in a dedicated scoping conversation, not guessed
at here:

- How does the customer's own agent authenticate/get scoped, sandboxed
  access to propose a PR against our repo (not our production
  infrastructure)?
- What does "reads this app's docs/API to know how to extend it" require
  concretely - is this the same mechanism as "AI communication prep" above,
  or something narrower (e.g. just a well-written `AGENTS.md`-equivalent
  scoped to the playground)?
- What's the actual playground surface - a real preview environment per
  proposal, a sandboxed branch/worktree, something else?
- Isolation/safety: what can a customer-triggered PoC actually touch (must
  not reach other tenants' data) - depends on however multi-tenancy ends up
  designed this time around.
