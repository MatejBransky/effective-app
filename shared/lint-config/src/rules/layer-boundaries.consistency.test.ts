import { globSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseJsonc, type ParseError } from "jsonc-parser";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { compileLayers, resolveLayerForPackageName, type LayerConfig } from "./layer-boundaries.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

interface OxlintConfig {
  rules: { "repo/layer-boundaries": [string, { layers: LayerConfig[] }] };
}

/** Reads the real `repo/layer-boundaries` options straight out of .oxlintrc.json - no copy kept here. */
function readConfiguredLayers(): LayerConfig[] {
  const errors: ParseError[] = [];
  const text = readFileSync(resolve(repoRoot, ".oxlintrc.json"), "utf8");
  const config = parseJsonc(text, errors) as OxlintConfig;
  expect(errors, ".oxlintrc.json failed to parse as JSONC").toEqual([]);
  return config.rules["repo/layer-boundaries"][1].layers;
}

/** Reads pnpm-workspace.yaml's `packages:` globs and turns each into a `package.json` glob. */
function readWorkspacePackageJsonGlobs(): string[] {
  const text = readFileSync(resolve(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const manifest = parseYaml(text) as { packages: string[] };
  return manifest.packages.map((packagesGlob) => `${packagesGlob}/package.json`);
}

describe("layer-boundaries config vs. the real workspace", () => {
  it("classifies every workspace package into exactly one configured layer", () => {
    const compiled = compileLayers(readConfiguredLayers());
    const packageJsonPaths = globSync(readWorkspacePackageJsonGlobs(), { cwd: repoRoot });

    // Sanity-check the glob itself found something - an empty result usually means
    // pnpm-workspace.yaml's `packages:` field no longer matches this shape, which would make
    // the rest of this test vacuous.
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
