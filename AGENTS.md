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
today and `docs/data-model.md` for the full writeup of each. Real domain business logic
(`domains/<name>`) hasn't started yet - those are still added iteratively, read
`tasks/roadmap.md` before assuming what's next.

Effect Schema (`shared/entities`, root export) is the single source of truth for domain
shapes - DB schema, API contracts, and FE forms/validation all derive from it, not the other
way round. Every entity (`Host`, `Member`, `MarketingSequence`, ...) lives together in this
one package, not split into per-entity packages - entities reference each other's branded id
types too densely for that split to pay off, and unlike the domain packages below, this half
of `shared/entities` has no UI and is consumed by `apps/server` as much as by `apps/client`.

`shared/entities`'s `./db` export (`shared/entities/src/db`) holds the Drizzle (Postgres)
side of that same source of truth: hand-written table definitions mirroring the root
export's Effect Schema, kept honest by a drift test (`shared/entities/src/db/drift.test.ts`)
rather than codegen - see "Effect Schema → Drizzle bridge" in `docs/data-model.md` for why.
It's a separate `package.json#exports` subpath, not a separate package, precisely because the
two are this tightly coupled - but still its own entry point (rather than folded into the
root export) so importing the Effect Schema half (e.g. from `apps/client`) never pulls
`drizzle-orm`/`pg` into a browser bundle; only `apps/server` imports `@repo/entities/db`.
Postgres RLS for multi-tenancy (mentioned above) is enabled and verified end-to-end - every
host-scoped table has a policy filtering on a `set_config('app.host_id', ...)` session
variable that `apps/server`'s `HostScopedDb.ts` sets per request from the verified JWT's
`host_id` claim - see "Postgres RLS for multi-tenancy" in `docs/data-model.md`.

Every app lives under `apps/<name>` and should be independently testable (vitest) via
Effect `Layer`/`Context` dependency injection - external processes and I/O go through
swappable services, never called directly, so unit tests never touch the real filesystem,
network, or shell. This applies in particular to auth: business logic talks to an
`AuthService` `Layer`, never to the identity provider's SDK directly, so the current
provider (self-hosted Keycloak, see "Auth: Keycloak + apps/server" in `docs/data-model.md`)
can be swapped without touching domain code.

This repo has four top-level layers - `shared/*`, `domains/*`, `apps/*`, and `scripts`
(singular - unlike the other three, this one is a single pnpm package, `@repo/scripts`, not
a glob of one-package-per-item; scripts don't need independent versioning or
`package.json#exports` boundaries from each other) - no `packages/*`. `domains/*` replaced
an originally-planned FSD `entities`/`features`/`widgets` split once cross-domain action
calls made that three-layer horizontal split the wrong shape; see "Action registry" in
`tasks/roadmap.md`'s "Done" section for why. `scripts/` is for codegen and other
repo-maintenance helpers that aren't shared runtime code, business logic, or a deployable
app - keep it out of `shared/*` even though both are "cross-cutting," since `scripts/`
existing at all shouldn't imply any other package is meant to import it at runtime.

`shared/*` holds two tiers of pnpm package, split by whether they know about business
shapes. `shared/lib` and `shared/app-shell` are the generic tier - the app-wide Atom
registry (React hooks come directly from `@effect/atom-react`, not a re-export - see
`shared/lib/src/index.ts`), a modal manager, a global keybindings registry, and an
Effect-based action mechanism (`defineAction`/`useActionTrigger`/`confirm`) - see
`tasks/roadmap.md`'s "Done" section and `docs/data-model.md`'s "App-shell state" section for
the design and verified end-to-end proof. `shared/entities` (both its root and `./db`
exports) is the business-shape tier. The generic tier must never depend on the
business-shape tier (the reverse - business-aware code depending on generic code - is fine,
and is already how `shared/app-shell` depends on `shared/lib`); there's no lint rule for
this, just don't add that `package.json` dependency - pnpm only resolves what's explicitly
declared, so an accidental deep-import fails at both TypeScript resolution and at runtime,
the same enforcement the domain-import rule below relies on.

`domains/<name>` (e.g. `domains/hosts`, `domains/members`) is where real business logic
lives, one pnpm package per domain, following [Feature-Sliced
Design](https://feature-sliced.design/)'s public-API discipline even without its layer
split: a domain's `package.json#exports` is its public API - do not import a path that
isn't exported, and do not add a barrel `index.ts` re-exporting internals just to work
around that. Named subpath exports (e.g. a `./server` export vs a `./client` export) are how
a domain isolates server-only code from client-only code without one import pulling in
both. Teams keep their own internal structure inside a domain package - not yet
standardized, open discussion.

Domains never import each other directly - cross-domain calls (starting with actions) go
through a typed, symbol-like `Context.Service` tag defined in `shared/*` next to the shape
it identifies, never through the implementing domain's own package. A domain composing
another domain's action `yield*`s that tag while building its own `Layer` - ordinary Effect
dependency resolution, no bespoke lookup mechanism. `apps/client` is the one place that
imports every domain's `Layer`, merges them (`Layer.mergeAll`), and builds the result once
at bootstrap, the same "one registration point" pattern the FSD layer-import rule used to
enforce through the pnpm/Turborepo package graph - don't add a domain-to-domain dependency
that would bypass it.
