Run `pnpm run verify` to verify each change,
which runs formatting, checks for type errors and linting errors and warnings.

No feature is complete if `pnpm run verify` does not pass without any errors.

Before writing any Effect code - analyze the Effect repo in ./repos/effect/ so you know how to write Effect properly.

This is a boilerplate monorepo for a local-first, multi-tenant, AI-agent-controllable
application (PowerSync + Effect Schema for FE/BE sync, Drizzle + Postgres RLS for
multi-tenancy, Cloudflare Workers for the API/agent surface). Reads are local-first -
instant from a PowerSync-replicated SQLite copy. Mutations require an online connection
by design, so conflicting concurrent edits are resolved by Postgres as the single source
of truth instead of needing client-side merge logic, which is the usual pain point of
fully offline-first apps. It intentionally contains no business logic yet - apps and
packages are added iteratively.

Every app lives under `apps/<name>` and should be independently testable (vitest) via
Effect `Layer`/`Context` dependency injection - external processes and I/O go through
swappable services, never called directly, so unit tests never touch the real filesystem,
network, or shell.
