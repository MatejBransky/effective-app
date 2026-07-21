# `effective-app`

Boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application, built with [Effect](https://effect.website). Reads are instant from a local
replica; mutations require the app to be online, avoiding the merge-conflict problems
typical of fully offline-first apps.

### Layout

- `apps/client` - local-first React PWA, structured with [Feature-Sliced Design](https://feature-sliced.design/)
- `apps/server` - Effect HTTP API on Cloudflare Workers
- `apps/infrastructure` - Alchemy IaC that deploys the above
- `packages/schema` - Effect Schema domain definitions - the single source of truth for DB, API, and FE validation. Not an FSD slice itself (it has no UI and is consumed by `apps/server` too, not just `apps/client`) - it sits below the FSD layers and they import entity/id types from it
- `packages/db` - hand-written Drizzle (Postgres) table definitions mirroring `packages/schema`, plus a drift test that fails if the two disagree - see "Effect Schema → Drizzle bridge" in `docs/data-model.md`
- `packages/entities`, `packages/features`, `packages/widgets` - FSD slices (not created yet - added iteratively as real business-logic UI lands), each its own package; a package's `package.json#exports` is its public API instead of a barrel `index.ts`, and the FSD layer-import rule (a slice may only depend on slices in strictly lower layers) is enforced through the pnpm/Turborepo package graph, not a folder-path lint rule
- `packages/shared` - cross-cutting FE code, each its own package (same pattern as the FSD slices above): `packages/shared/lib` (the app-wide `@effect/atom-react` registry) and `packages/shared/app-shell` (a modal manager, global keybindings, and an Effect-based action registry - see "App-shell state" in `docs/data-model.md`) exist; `ui-kit`/`api-client`/`config` don't yet
- `packages/lint-config`, `packages/typescript-config` - shared tooling config
- `externals/effect` - reference copy of the Effect source (git subtree), consulted before writing Effect code; includes `packages/atom/react`, Effect-TS's own official React bindings for `effect/unstable/reactivity`'s Atom (published as `@effect/atom-react`, used directly by `apps/client`/`packages/shared/app-shell` - no separate `externals/effect-atom` subtree needed, that older standalone package still pins `effect@^3.19`)
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
