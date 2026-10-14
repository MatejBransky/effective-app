# Anti-slop vendored plugin — provenance

Source repository: `dmmulroy/anti-slop` (per this repo's `skills-lock.json` entry
for `install-anti-slop`, `skillPath: skills/install-anti-slop/SKILL.md`).

Source revision: unknown. The plugin was copied from the locally installed
`install-anti-slop` skill bundle (`.agents/skills/install-anti-slop/assets/anti-slop/`)
via its `scripts/install.mjs` on 2026-10-14. The bundle carries no commit hash or
version marker, so no exact upstream commit can be claimed. A future update should
resolve an explicit upstream revision and record it here as the new baseline.

Installed paths:

- Generic plugin entry: `tools/oxlint/anti-slop/index.ts` (plugin name `anti-slop`)
- Opt-in Effect plugin entry: `tools/oxlint/anti-slop/effect/index.ts`
  (plugin name `anti-slop-effect`)
- Nested vendored license/provenance retained verbatim:
  `tools/oxlint/anti-slop/vendor/eslint-stylistic/LICENSE` and
  `tools/oxlint/anti-slop/vendor/eslint-stylistic/UPSTREAM.md`
  (ESLint Stylistic `padding-line-between-statements`, commit
  `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08` — see that file for details).

Intentional local deviations from the skill defaults:

- Oxlint dependency pair pinned through the pnpm catalog (`pnpm-workspace.yaml`:
  `oxlint: 1.88.0`, `@oxlint/plugins: 1.88.0`, both exact via `saveExact: true`)
  with `@oxlint/plugins: catalog:` in the root `devDependencies`, matching this
  repo's catalog convention instead of a bare version string in `package.json`.
- Extra ignore pattern `.playwright-mcp/**` added alongside the skill's default
  agent-tooling ignores in both `.oxlintrc.json` and `.oxfmtrc.json`: that
  directory holds Playwright MCP-generated logs/snapshots, not application source.
- Same ignore set merged into `.oxfmtrc.json` (this repo's oxfmt config) so the
  formatter also skips agent assets and the vendored plugin.
- The existing `jsPlugins: ["@repo/shared-lint-config"]` entry, `plugins` set,
  existing ignore patterns, and `repo/no-type-assertion` rule were preserved;
  the anti-slop plugins were appended, not substituted.
- Effect rules enabled because `effect` is a direct dependency in
  `apps/client`, `apps/server`, and `apps/infrastructure` package manifests
  (not merely transitive). Package-alias imports remain a known enforcement
  limitation per the skill (relative project imports only).
