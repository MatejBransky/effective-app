# `effective-app`

Boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application, built with [Effect](https://effect.website). Reads are instant from a local
replica; mutations require the app to be online, avoiding the merge-conflict problems
typical of fully offline-first apps.

### Architecture

![Layer diagram: shared (utils/API, entities) at the top, domains in the middle (domain A and domain B never import each other directly), apps at the bottom (client and server never import each other directly, but depend on both domains and shared), scripts off to the side depending on apps](docs/app-arch.svg)

Four top-level layers, no `packages/*`:

- `shared/*` - one pnpm package per cross-cutting concern, split into two tiers. The generic
  tier (`shared/lib`, `shared/app-shell`) knows nothing about business shapes and must never
  depend on the business-shape tier (`shared/entities`) - the reverse dependency is fine and
  already how `shared/app-shell` depends on `shared/lib`.
- `domains/*` - one pnpm package per business domain (e.g. `domains/hosts`), not created yet.
  A domain's `package.json#exports` is its public API - no barrel `index.ts` working around
  that. Domains never import each other directly; cross-domain calls (starting with actions)
  go through a typed `Context.Service` tag defined in `shared/*`, resolved via ordinary
  Effect dependency injection, not a bespoke lookup mechanism.
- `apps/*` - `apps/client` (local-first React PWA), `apps/server` (Effect HTTP API on
  Cloudflare Workers), `apps/infrastructure` (Alchemy IaC deploying both). `apps/client` is
  the one place that imports every domain's `Layer` and merges them (`Layer.mergeAll`).
- `scripts/` - a single pnpm package (`@repo/scripts`), not one-per-item like the layers
  above, for codegen and repo-maintenance helpers that nothing else is meant to import at
  runtime.

See `AGENTS.md` for the full layer rules (why the split replaced an originally-planned FSD
`entities`/`features`/`widgets` structure, and how the generic/business-shape tier boundary
inside `shared/*` is enforced without a lint rule).

### Layout

- `apps/client` - local-first React PWA
- `apps/server` - Effect HTTP API on Cloudflare Workers
- `apps/infrastructure` (`@repo/infra`) - Alchemy IaC that deploys the above
- `shared/entities` - Effect Schema domain definitions (root export) - the single source of
  truth for DB, API, and FE validation - plus hand-written Drizzle (Postgres) table
  definitions (`./db` export) mirroring those same shapes, kept honest by a drift test
  rather than codegen - see "Effect Schema → Drizzle bridge" in `docs/data-model.md`. Two
  export subpaths instead of two packages precisely because they're this tightly coupled,
  but still separate so importing the Effect Schema half never pulls `drizzle-orm`/`pg` into
  `apps/client`'s browser bundle
- `shared/lib` - the app-wide `@effect/atom-react` registry
- `shared/app-shell` - a modal manager, global keybindings, and an Effect-based action
  registry (see "App-shell state" in `docs/data-model.md`)
- `shared/lint-config`, `shared/typescript-config` - shared tooling config
- `domains/*` - business-logic packages, not created yet - added iteratively as real
  business logic lands, see `tasks/roadmap.md`
- `scripts/` - repo-maintenance scripts/codegen, not created yet
- `externals/effect` - reference copy of the Effect source (git subtree), consulted before writing Effect code; includes `packages/atom/react`, Effect-TS's own official React bindings for `effect/unstable/reactivity`'s Atom (published as `@effect/atom-react`, used directly by `apps/client`/`shared/app-shell` - no separate `externals/effect-atom` subtree needed, that older standalone package still pins `effect@^3.19`)
- `externals/alchemy-effect` - reference copy of [alchemy-run/alchemy-effect](https://github.com/alchemy-run/alchemy-effect) (git subtree), the Effect-native flavor of Alchemy - consulted before writing infrastructure (IaC) code
- `externals/opencode` - reference copy of [anomalyco/opencode](https://github.com/anomalyco/opencode) (git subtree, `dev` branch), an AI coding agent - consulted for agent/CLI tooling patterns

Apps and packages beyond the tooling above are added iteratively - see the note in
`AGENTS.md`.

### Local development

No AWS/Cloudflare account is needed to develop against Postgres, email, auth, or
PowerSync locally:

```sh
cp .env.example .env
pnpm run dev:infra       # starts Postgres + Mailpit + Keycloak + PowerSync (docker compose)
pnpm run dev:infra:down  # stops them
pnpm --filter @repo/server run dev  # apps/server, once dev:infra is up
pnpm --filter @repo/client run dev  # apps/client, once apps/server is up
```

- Postgres: `localhost:5442` (off the standard 5432 to avoid colliding with other local Postgres instances - see `.env.example` for credentials)
- Mailpit web UI: [localhost:18025](http://localhost:18025) - catches all outgoing email sent via SMTP on `localhost:11025`, nothing leaves your machine
- Keycloak (self-hosted): `localhost:8180` - realm/client/test-user seeded from `keycloak/realm-export.json` on first start; see docs/data-model.md's "Auth: Keycloak + apps/server" section for how tokens carry the `host_id` claim `apps/server` and PowerSync both rely on
- PowerSync (self-hosted): `localhost:8080` - see `powersync/sync-config.yaml` for what syncs, and docs/data-model.md's "PowerSync sync streams" section for the setup and what's still deferred (a scoped replication role)

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html/) for code linting
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for code formatting
- [Turborepo](https://turborepo.dev/) for task orchestration/caching
- [Vitest](https://vitest.dev/) for testing
