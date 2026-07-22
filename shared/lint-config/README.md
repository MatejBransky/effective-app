# @repo/shared-lint-config

Custom oxlint JS plugin (`repo/*`), loaded via `.oxlintrc.json`'s `jsPlugins`.

## Rules

### `repo/no-type-assertion`

Disallows `as any`, `as never`, and `as unknown`.

### `repo/layer-boundaries`

Enforces directional import boundaries between workspace layers (`shared` -> `entities` ->
`domains` -> `app` -> `scripts`). A layer may only import from layers below it in the
configured order; same-layer imports across different packages are denied by default.

Matching is by `package.json#name` (wildcard patterns), not by directory - a package's
physical location under `apps/*`/`shared/*`/`domains/*`/`scripts` doesn't have to match its
layer. See `.oxlintrc.json`'s `repo/layer-boundaries` options for the current layer list.

```jsonc
{
  "rules": {
    "repo/layer-boundaries": [
      "error",
      {
        "layers": [
          { "layer": "shared", "packages": "@repo/shared-*", "allowSameLayerImports": true },
          { "layer": "domains", "packages": "@repo/domain-*" }, // allowSameLayerImports: false (default)
        ],
      },
    ],
  },
}
```

`shared/lint-config/src/rules/layer-boundaries.consistency.test.ts` reads `.oxlintrc.json` and
`pnpm-workspace.yaml` directly and fails if any real workspace package doesn't match exactly
one configured layer - run it (`pnpm test`) after adding a package or renaming a layer pattern.
