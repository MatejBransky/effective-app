import { globSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compileLayers, resolveLayerForPackageName, type LayerConfig } from "./layer-boundaries.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

// Mirrors pnpm-workspace.yaml's `packages:` field - update both together.
const WORKSPACE_PACKAGE_JSON_GLOBS = [
  "apps/*/package.json",
  "shared/*/package.json",
  "domains/*/package.json",
  "scripts/package.json",
];

// Mirrors .oxlintrc.json's `repo/layer-boundaries` rule options - update both together.
const LAYERS: LayerConfig[] = [
  { layer: "shared", packages: "@repo/shared-*", allowSameLayerImports: true },
  { layer: "entities", packages: "@repo/entities", allowSameLayerImports: true },
  { layer: "domains", packages: "@repo/domain-*" },
  { layer: "app", packages: "@repo/app-*" },
  { layer: "scripts", packages: "@repo/scripts" },
];

describe("layer-boundaries config vs. the real workspace", () => {
  it("classifies every workspace package into exactly one configured layer", () => {
    const compiled = compileLayers(LAYERS);
    const packageJsonPaths = globSync(WORKSPACE_PACKAGE_JSON_GLOBS, { cwd: repoRoot });

    // Sanity-check the glob itself found something - an empty result usually means the globs
    // above drifted from pnpm-workspace.yaml, which would make the rest of this test vacuous.
    expect(packageJsonPaths.length).toBeGreaterThan(0);

    const unclassified: string[] = [];
    for (const relativePath of packageJsonPaths) {
      const { name } = JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8")) as {
        name: string;
      };
      if (!resolveLayerForPackageName(name, compiled)) unclassified.push(name);
    }

    expect(unclassified).toEqual([]);
  });
});
