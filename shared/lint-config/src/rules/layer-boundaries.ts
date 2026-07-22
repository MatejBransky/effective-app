import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { RuleContext } from "../types.ts";

export interface LayerConfig {
  layer: string;
  /** Wildcard pattern(s) (`*` only) matched against a workspace package's `package.json#name`. */
  packages: string | string[];
  /** Whether packages within this layer may import each other. Default: `false` (fail closed). */
  allowSameLayerImports?: boolean;
}

interface CompiledLayer {
  layer: string;
  index: number;
  allowSameLayerImports: boolean;
  test: (packageName: string) => boolean;
}

function wildcardToRegExp(pattern: string): RegExp {
  // Package names have no `**`/brace-expansion needs - `*` -> `.*` is enough.
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function compileLayers(layers: readonly LayerConfig[]): CompiledLayer[] {
  return layers.map((layer, index) => {
    const patterns = Array.isArray(layer.packages) ? layer.packages : [layer.packages];
    const regexes = patterns.map(wildcardToRegExp);
    return {
      layer: layer.layer,
      index,
      allowSameLayerImports: layer.allowSameLayerImports ?? false,
      test: (name: string) => regexes.some((regExp) => regExp.test(name)),
    };
  });
}

/**
 * Resolves which configured layer a package name belongs to. Layer patterns are expected to
 * be mutually exclusive (by naming convention); a name matching more than one is a config
 * mistake, not a normal lint finding, so it throws instead of silently picking one.
 */
export function resolveLayerForPackageName(
  packageName: string,
  layers: readonly CompiledLayer[],
): CompiledLayer | null {
  const matches = layers.filter((layer) => layer.test(packageName));
  if (matches.length > 1) {
    throw new Error(
      `layer-boundaries: package "${packageName}" matches multiple layers (${matches
        .map((layer) => layer.layer)
        .join(", ")}). Layer package patterns must be mutually exclusive.`,
    );
  }
  return matches[0] ?? null;
}

/** Extracts the package-name portion of an import specifier, or `null` for relative specifiers. */
export function getPackageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  const segments = specifier.split("/");
  if (specifier.startsWith("@")) return segments.slice(0, 2).join("/");
  return segments[0] ?? null;
}

const packageNameCache = new Map<string, string | null>();

/** Finds the nearest ancestor `package.json` starting at `startPath` (inclusive) and returns its `name`. */
export function findNearestPackageName(startPath: string): string | null {
  const visited: string[] = [];
  let dir = startPath;

  while (true) {
    const cached = packageNameCache.get(dir);
    if (cached !== undefined) {
      for (const visitedDir of visited) packageNameCache.set(visitedDir, cached);
      return cached;
    }

    visited.push(dir);
    const packageJsonPath = resolve(dir, "package.json");
    if (existsSync(packageJsonPath)) {
      const name =
        (JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string }).name ?? null;
      for (const visitedDir of visited) packageNameCache.set(visitedDir, name);
      return name;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      for (const visitedDir of visited) packageNameCache.set(visitedDir, null);
      return null;
    }
    dir = parent;
  }
}

export interface SourceNode {
  source: { type: string; value: string };
}

function reportIfViolation(
  context: RuleContext,
  node: unknown,
  currentPackageName: string,
  currentLayer: CompiledLayer,
  importedPackageName: string,
  targetLayer: CompiledLayer,
) {
  if (targetLayer.index === currentLayer.index) {
    if (!currentLayer.allowSameLayerImports) {
      context.report({
        node,
        message: `"${currentPackageName}" (layer "${currentLayer.layer}") must not import "${importedPackageName}" - packages within layer "${currentLayer.layer}" cannot import each other.`,
      });
    }
    return;
  }
  if (targetLayer.index > currentLayer.index) {
    context.report({
      node,
      message: `"${currentPackageName}" (layer "${currentLayer.layer}") must not import "${importedPackageName}" (layer "${targetLayer.layer}") - layers may only import from layers below them.`,
    });
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce directional import boundaries between workspace layers.",
    },
    schema: [
      {
        type: "object",
        properties: {
          layers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                layer: { type: "string" },
                packages: {
                  anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
                },
                allowSameLayerImports: { type: "boolean" },
              },
              required: ["layer", "packages"],
              additionalProperties: false,
            },
          },
        },
        required: ["layers"],
        additionalProperties: false,
      },
    ],
  },
  create(context: RuleContext) {
    const options = (context.options[0] ?? { layers: [] }) as { layers: readonly LayerConfig[] };
    const layers = compileLayers(options.layers);

    const currentPackageName = findNearestPackageName(dirname(context.filename));
    const currentLayer = currentPackageName
      ? resolveLayerForPackageName(currentPackageName, layers)
      : null;

    function check(node: unknown, source: string | undefined | null) {
      if (!currentLayer || !currentPackageName || !source) return;

      const importedPackageName =
        getPackageNameFromSpecifier(source) ??
        findNearestPackageName(resolve(dirname(context.filename), source));
      if (!importedPackageName || importedPackageName === currentPackageName) return;

      const targetLayer = resolveLayerForPackageName(importedPackageName, layers);
      if (!targetLayer) return;

      reportIfViolation(
        context,
        node,
        currentPackageName,
        currentLayer,
        importedPackageName,
        targetLayer,
      );
    }

    return {
      ImportDeclaration(node: SourceNode) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node: { source?: { value: string } | null }) {
        check(node, node.source?.value);
      },
      ExportAllDeclaration(node: SourceNode) {
        check(node, node.source.value);
      },
      ImportExpression(node: { source: { type: string; value?: string } }) {
        if (node.source.type === "StringLiteral") check(node, node.source.value);
      },
    };
  },
};

export default rule;
