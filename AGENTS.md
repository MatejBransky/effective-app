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
this repo intends to use to deploy to Cloudflare) and is the source of truth for how resources,
providers, and state are modeled the Effect way here - don't copy patterns from plain
Alchemy docs/examples that aren't Effect-based without checking they still apply.

This is a boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application (PowerSync + Effect Schema for FE/BE sync, Drizzle + Postgres RLS for
multi-tenancy, Cloudflare Workers for the API/agent surface). Reads are meant to be
local-first - instant from a PowerSync-replicated SQLite copy. Mutations require the app to
be online, which avoids the merge-conflict problems typical of fully offline-first apps.
None of the domain model, auth, RLS, sync loop, or infrastructure is built yet - see
`tasks/roadmap.md` before assuming what's next.

Every app lives under `apps/<name>` and should be independently testable (vitest) via
Effect `Layer`/`Context` dependency injection - external processes and I/O go through
swappable services, never called directly, so unit tests never touch the real filesystem,
network, or shell. This applies in particular to auth: business logic should talk to an
`AuthService` `Layer`, never to the identity provider's SDK directly, so the identity
provider can be swapped without touching domain code.

This repo has four top-level layers - `shared/*`, `domains/*`, `apps/*`, and `scripts`
(singular - unlike the other three, this one is a single pnpm package, `@repo/scripts`, not
a glob of one-package-per-item; scripts don't need independent versioning or
`package.json#exports` boundaries from each other) - no `packages/*`. `domains/*` replaces
an originally-planned FSD `entities`/`features`/`widgets` split, which turned out to be the
wrong shape once cross-domain action calls were considered - a horizontal, three-layer split
doesn't compose well with domains that need to call into each other. `scripts/` is for
codegen and other repo-maintenance helpers that aren't shared runtime code, business logic,
or a deployable app - keep it out of `shared/*` even though both are "cross-cutting," since
`scripts/` existing at all shouldn't imply any other package is meant to import it at
runtime.

`shared/*` holds two tiers of pnpm package, split by whether they know about business
shapes. A generic tier (cross-cutting FE/BE code with no business shapes - e.g. an app-wide
state registry, a modal manager, a keybindings registry) must never depend on a
business-shape tier (domain entity/schema definitions) - the reverse (business-aware code
depending on generic code) is fine. There's no lint rule for this, just don't add that
`package.json` dependency - pnpm only resolves what's explicitly declared, so an accidental
deep-import fails at both TypeScript resolution and at runtime, the same enforcement the
domain-import rule below relies on. Neither tier exists yet - added iteratively, read
`tasks/roadmap.md` before assuming what's next.

`domains/<name>` (e.g. `domains/hosts`, `domains/members`) is where real business logic
will live, one pnpm package per domain, following [Feature-Sliced
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
dependency resolution, no bespoke lookup mechanism. Whichever app composes every domain
(e.g. `apps/client`) is the one place that imports every domain's `Layer`, merges them
(`Layer.mergeAll`), and builds the result once at bootstrap - the same "one registration
point" pattern the FSD layer-import rule used to enforce through the pnpm/Turborepo package
graph - don't add a domain-to-domain dependency that would bypass it.
