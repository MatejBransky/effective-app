# Roadmap - what's left to make this boilerplate "complete"

This is the higher-level index of remaining initiatives, written up because a
new session is starting and this list only existed in conversation until now.

## Done (verified live)

Domain model as Effect Schema, Drizzle bridge with a drift test, Postgres RLS
per-tenant isolation, self-hosted Keycloak issuing `host_id`-scoped JWTs,
self-hosted PowerSync (Sync Streams, least-privilege replication role),
`apps/server` with JWT verification and RLS-backed query/upload endpoints.
**`tasks/integrate-client.md`** - `apps/client` wired to real Keycloak login
(Authorization Code + PKCE, in-memory tokens, silent-renew-on-reload) and a
real PowerSync client (hand-written schema + drift check, custom-backend
connector, a `POST /sync/upload` endpoint), closing the local-first loop
from browser to Postgres and back - including a live demo of "reads work
offline, mutations need connectivity" (`useStatus()`-gated UI, verified by
stopping `apps/server` mid-edit and watching the write queue then flush).
See `docs/data-model.md` for the full writeup of each.

## In progress

- **`apps/infrastructure`** - "Alchemy IaC that deploys the above." Started:
  scaffolded against `repos/alchemy-effect` (the Effect-native Alchemy
  flavor this repo vendors for this - see `docs/data-model.md`'s "Cloudflare
  deployment (apps/infrastructure)" section for the full architecture
  writeup, including how Postgres/Hyperdrive, zero-downtime, and local dev
  parity were resolved). First deployable unit built and **verified live**:
  a trivial `HelloWorker` (`alchemy.run.ts` + `src/HelloWorker.ts`) deployed
  to a real Cloudflare account - `pnpm --filter @effective-app/infrastructure
run deploy` bootstrapped `Cloudflare.state()`'s state-store Worker, then
  deployed `HelloWorker`, and the live `*.workers.dev` URL returned
  `hello world` (HTTP 200) on the first request. Proves the whole toolchain
  (credentials, state-store bootstrap, a real deploy) before `apps/server`
  itself depends on it.
  `apps/client` now also deploys as static assets
  (`Cloudflare.Website.StaticSite`, reusing its own `pnpm run build` -
  see `docs/data-model.md`'s "GitHub CI/CD" section), with GitHub Actions
  CI/CD wired up: `.github/workflows/ci.yml` runs tests, a security check
  (`pnpm audit` + `gitleaks`), and deploys to a `pr-{number}`-staged preview
  per PR (auto-destroyed on close) or `prod` on merge to `main`, gated on
  tests/security passing first. **Known limitation, not yet fixed:** PR
  previews render the UI shell only - login/data sync don't work until
  `apps/server`/Keycloak/PowerSync are internet-reachable (see below).
  **Verified end-to-end** (2026-07-17): a real throwaway PR exercised the
  whole pipeline - test/security/deploy all green, an isolated `pr-1` stage
  live at a real URL, the bot comment posted correctly, and closing the PR
  destroyed `pr-1` for real (confirmed via the Cloudflare API, not just the
  job's exit status). Two real CI-only bugs found and fixed in the process:
  `deploy`/`destroy` unconditionally tried to source the (correctly
  gitignored, CI-absent) `.env` file, and `destroy` silently no-op'd
  without `--yes` in a non-interactive shell while still reporting success -
  see `docs/data-model.md`'s "GitHub CI/CD" section for both.
  GitHub also flagged 20 Dependabot vulnerabilities (7 high, 9 moderate, 4
  low) on the dependency tree during this - not yet triaged, separate task.
  Remaining phases (per `docs/data-model.md`): `apps/server`'s HTTP
  transport swap (`NodeHttpServer` → Worker `fetch` handler), Hyperdrive +
  Cloudflare Tunnel wiring for Postgres (this is what unblocks a fully
  functional PR preview, not just the UI shell), then Cron Triggers/Queues
  examples.

## Documented as planned, not built yet

- **`packages/shared`'s "app-shell state"** - a modal manager / app-shell
  manager / keybindings layer (command palette style global shortcuts, a
  place to trigger modals from anywhere in the tree without prop-drilling).
  Independent of the backend/infra work above - can be built in parallel,
  no dependencies on `apps/infrastructure` or the PowerSync client wiring.

## New idea from this conversation: scheduled/async jobs example

A concrete example of a scheduled/background job (Effect `Schedule` or
similar) that:

- Runs locally during dev without needing any external/online service.
- Also runs after deployment to Cloudflare (Cron Triggers or Queues,
  whichever fits) - the point is proving **local/cloud parity**: the same
  logic works in both places, not two different implementations.

This depends on `apps/infrastructure` existing first (nothing to deploy to
Cloudflare and verify parity against until then) - do it after, not before,
the infrastructure item above.

## Exploratory - needs a dedicated design conversation before it's a real task

These two are related (the second depends on the first) but neither is
concretely scoped yet - don't start building against guesses. Flagged here
so they aren't lost, not as ready-to-implement plans.

### AI communication prep (general capability)

`AGENTS.md`/`README.md` both call this app "AI-agent-controllable" without
saying what that means technically. Left open when this roadmap was written

- candidates discussed: an MCP server exposing `apps/server`'s capabilities
  as tools, vs. just making sure `HttpApi` contracts/error types/docs are
  clean enough for any agent to code against directly. Revisit before
  starting the item below, since it depends on this being resolved first.

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
  not reach other tenants' data - ties back into the RLS/multi-tenancy work
  already done).
