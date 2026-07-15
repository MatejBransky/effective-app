# `effective-app`

Boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application, built with [Effect](https://effect.website). Reads are instant from a local
replica; mutations require the app to be online, avoiding the merge-conflict problems
typical of fully offline-first apps.

### Layout

- `apps/*` - individual applications (added iteratively)
- `packages/*` - shared config and libraries used across apps
- `repos/effect` - reference copy of the Effect source (git subtree), consulted before writing Effect code

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html/) for code linting
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) for code formatting
- [Turborepo](https://turborepo.dev/) for task orchestration/caching
- [Vitest](https://vitest.dev/) for testing
