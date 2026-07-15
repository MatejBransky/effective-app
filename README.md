# `effective-app`

Boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application, built with [Effect](https://effect.website). Reads are instant from a local
replica; mutations require the app to be online, avoiding the merge-conflict problems
typical of fully offline-first apps.

### Layout

- `apps/client` - local-first React PWA, structured with [Feature-Sliced Design](https://feature-sliced.design/)
- `apps/server` - Effect HTTP API on Cloudflare Workers
- `apps/infrastructure` - Alchemy IaC that deploys the above
- `packages/schema` - Effect Schema domain definitions - the single source of truth for DB, API, and FE validation
- `packages/entities`, `packages/features`, `packages/widgets` - FSD slices, each its own package; a package's `package.json#exports` is its public API instead of a barrel `index.ts`, and the FSD layer-import rule (a slice may only depend on slices in strictly lower layers) is enforced through the pnpm/Turborepo package graph, not a folder-path lint rule
- `packages/shared` - cross-cutting FE code (ui kit, api client, app-shell state, lib, config)
- `packages/lint-config`, `packages/typescript-config` - shared tooling config
- `repos/effect` - reference copy of the Effect source (git subtree), consulted before writing Effect code

Apps and packages beyond the tooling above are added iteratively - see the note in
`AGENTS.md`.

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html/) for code linting
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for code formatting
- [Turborepo](https://turborepo.dev/) for task orchestration/caching
- [Vitest](https://vitest.dev/) for testing
