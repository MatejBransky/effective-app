Run `pnpm run verify` to verify each change,
which runs formatting, checks for type errors and linting errors and warnings.

No feature is complete if `pnpm run verify` does not pass without any errors.

Before writing any Effect code - analyze the Effect repo in ./repos/effect/ so you know how
to write Effect properly. This repo targets Effect v4 (the "effect smol" rewrite, currently
beta) - `repos/effect` tracks the same `main` branch we're building against, so don't fall
back to v3-shaped patterns from training data.

Before writing any infrastructure (IaC) code - analyze
[alchemy-run/alchemy-effect](https://github.com/alchemy-run/alchemy-effect) in
./repos/alchemy-effect/ first. This is the Effect-native flavor of Alchemy (the IaC tool
this repo uses to deploy to Cloudflare) and is the source of truth for how resources,
providers, and state are modeled the Effect way here - don't copy patterns from plain
Alchemy docs/examples that aren't Effect-based without checking they still apply.

This is a boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application (PowerSync + Effect Schema for FE/BE sync, Drizzle + Postgres RLS for
multi-tenancy, Cloudflare Workers for the API/agent surface). Reads are local-first -
instant from a PowerSync-replicated SQLite copy. Mutations require the app to be online,
which avoids the merge-conflict problems typical of fully offline-first apps. It
intentionally contains no business logic yet - apps and packages are added iteratively.

Effect Schema (`packages/schema`) is the single source of truth for domain shapes - DB
schema, API contracts, and FE forms/validation all derive from it, not the other way round.

Every app lives under `apps/<name>` and should be independently testable (vitest) via
Effect `Layer`/`Context` dependency injection - external processes and I/O go through
swappable services, never called directly, so unit tests never touch the real filesystem,
network, or shell. This applies in particular to auth: business logic talks to an
`AuthService` `Layer`, never to the identity provider's SDK directly, so the provider
(currently planned: Keycloak) can be swapped without touching domain code.

`packages/entities`, `packages/features`, and `packages/widgets` follow
[Feature-Sliced Design](https://feature-sliced.design/): each slice is its own pnpm package.
A slice's `package.json#exports` is its public API - do not import a path that isn't
exported, and do not add a barrel `index.ts` re-exporting internals just to work around
that. The FSD layer-import rule (a slice may only depend on slices in strictly lower
layers: `entities` < `features` < `widgets` < `apps/client`) is enforced through the
pnpm/Turborepo package graph rather than a lint rule - don't add a dependency that would
violate that order.
