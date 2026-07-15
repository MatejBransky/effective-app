# `effective-app`

Boilerplate monorepo for an offline-first, multi-tenant, AI-agent-controllable
application, built with [Effect](https://effect.website).

### Layout

- `apps/*` - individual applications (added iteratively)
- `packages/*` - shared config and libraries used across apps
- `repos/effect` - reference copy of the Effect source (git subtree), consulted before writing Effect code

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html/) for code linting
- [Turborepo](https://turborepo.dev/) for task orchestration/caching
- [Vitest](https://vitest.dev/) for testing
