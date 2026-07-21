Run `pnpm run verify` to verify each change,
which runs formatting, checks for type errors and linting errors and warnings.

No feature is complete if `pnpm run verify` does not pass without any errors.

Before writing any Effect code - analyze the Effect repo in ./externals/effect/ so you know how
to write Effect properly. This repo targets Effect v4 (the "effect smol" rewrite, currently
beta) - `externals/effect` tracks the same `main` branch we're building against, so don't fall
back to v3-shaped patterns from training data.

Before writing any infrastructure (IaC) code - analyze
[alchemy-run/alchemy-effect](https://github.com/alchemy-run/alchemy-effect) in
./externals/alchemy-effect/ first. This is the Effect-native flavor of Alchemy (the IaC tool
this repo uses to deploy to Cloudflare) and is the source of truth for how resources,
providers, and state are modeled the Effect way here - don't copy patterns from plain
Alchemy docs/examples that aren't Effect-based without checking they still apply.

This is a boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application (PowerSync + Effect Schema for FE/BE sync, Drizzle + Postgres RLS for
multi-tenancy, Cloudflare Workers for the API/agent surface). Reads are local-first -
instant from a PowerSync-replicated SQLite copy. Mutations require the app to be online,
which avoids the merge-conflict problems typical of fully offline-first apps. The domain
model (`Host`/`Member`/marketing sequences), auth, RLS, and the local-first sync loop are
built and verified live - see `tasks/roadmap.md`'s "Done" section for exactly what exists
today and `docs/data-model.md` for the full writeup of each. Real FSD-slice business logic
(`packages/entities`/`features`/`widgets`) hasn't started yet - those are still added
iteratively, read `tasks/roadmap.md` before assuming what's next.

Effect Schema (`packages/schema`) is the single source of truth for domain shapes - DB
schema, API contracts, and FE forms/validation all derive from it, not the other way round.
Every entity (`Host`, `Member`, `MarketingSequence`, ...) lives together in this one package,
not split into per-entity packages - entities reference each other's branded id types too
densely for that split to pay off, and unlike the FSD slices below, `packages/schema` has no
UI and is consumed by `apps/server` as much as by `apps/client`.

`packages/db` holds the Drizzle (Postgres) side of that source of truth: hand-written
table definitions mirroring `packages/schema`, kept honest by a drift test
(`packages/db/src/drift.test.ts`) rather than codegen - see "Effect Schema → Drizzle
bridge" in `docs/data-model.md` for why. Postgres RLS for multi-tenancy (mentioned
above) is enabled and verified end-to-end - every host-scoped table has a policy
filtering on a `set_config('app.host_id', ...)` session variable that `apps/server`'s
`HostScopedDb.ts` sets per request from the verified JWT's `host_id` claim - see
"Postgres RLS for multi-tenancy" in `docs/data-model.md`.

Every app lives under `apps/<name>` and should be independently testable (vitest) via
Effect `Layer`/`Context` dependency injection - external processes and I/O go through
swappable services, never called directly, so unit tests never touch the real filesystem,
network, or shell. This applies in particular to auth: business logic talks to an
`AuthService` `Layer`, never to the identity provider's SDK directly, so the current
provider (self-hosted Keycloak, see "Auth: Keycloak + apps/server" in `docs/data-model.md`)
can be swapped without touching domain code.

`packages/shared/lib` and `packages/shared/app-shell` exist and hold real cross-cutting FE
code: the app-wide Atom registry (React hooks come directly from `@effect/atom-react`, not
a re-export - see `packages/shared/lib/src/index.ts`), a modal manager, a global keybindings
registry, and an Effect-based action registry (`defineAction`/`useActionTrigger`/`confirm`) -
see `tasks/roadmap.md`'s "Done" section and `docs/data-model.md`'s "App-shell state" section
for the design and verified end-to-end proof. `packages/entities`/`features`/`widgets` don't
exist yet - real business-logic FSD slices, added iteratively.

`packages/entities`, `packages/features`, and `packages/widgets` follow
[Feature-Sliced Design](https://feature-sliced.design/): each slice is its own pnpm package.
A slice's `package.json#exports` is its public API - do not import a path that isn't
exported, and do not add a barrel `index.ts` re-exporting internals just to work around
that. The FSD layer-import rule (a slice may only depend on slices in strictly lower
layers: `entities` < `features` < `widgets` < `apps/client`) is enforced through the
pnpm/Turborepo package graph rather than a lint rule - don't add a dependency that would
violate that order.
