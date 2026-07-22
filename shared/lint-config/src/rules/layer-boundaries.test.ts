import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { RuleContext } from "../types.ts";
import rule, {
  compileLayers,
  findNearestPackageName,
  getPackageNameFromSpecifier,
  type LayerConfig,
  resolveLayerForPackageName,
} from "./layer-boundaries.ts";

const thisDir = dirname(fileURLToPath(import.meta.url));

const LAYERS: LayerConfig[] = [
  { layer: "shared", packages: "@repo/shared-*", allowSameLayerImports: true },
  { layer: "entities", packages: "@repo/entities", allowSameLayerImports: true },
  { layer: "domains", packages: "@repo/domain-*" },
  { layer: "app", packages: "@repo/client" },
  { layer: "scripts", packages: "@repo/scripts" },
];

function createFakeContext(filename: string, layers: readonly LayerConfig[]) {
  const messages: string[] = [];
  const context: RuleContext = {
    filename,
    options: [{ layers }],
    report: ({ message }) => messages.push(message),
    getSourceCode: () => {
      throw new Error("not used by this rule");
    },
  };
  return { context, messages };
}

describe("getPackageNameFromSpecifier", () => {
  it("extracts scoped package names, ignoring subpaths", () => {
    expect(getPackageNameFromSpecifier("@repo/domain-hosts")).toBe("@repo/domain-hosts");
    expect(getPackageNameFromSpecifier("@repo/domain-hosts/server")).toBe("@repo/domain-hosts");
  });

  it("extracts unscoped package names, ignoring subpaths", () => {
    expect(getPackageNameFromSpecifier("effect")).toBe("effect");
    expect(getPackageNameFromSpecifier("effect/Layer")).toBe("effect");
  });

  it("returns null for relative and absolute specifiers", () => {
    expect(getPackageNameFromSpecifier("./foo")).toBeNull();
    expect(getPackageNameFromSpecifier("../foo/bar")).toBeNull();
    expect(getPackageNameFromSpecifier("/abs/path")).toBeNull();
  });
});

describe("resolveLayerForPackageName", () => {
  const compiled = compileLayers(LAYERS);

  it("resolves a package name to its configured layer", () => {
    expect(resolveLayerForPackageName("@repo/domain-hosts", compiled)?.layer).toBe("domains");
    expect(resolveLayerForPackageName("@repo/entities", compiled)?.layer).toBe("entities");
  });

  it("returns null for names matching no layer", () => {
    expect(resolveLayerForPackageName("react", compiled)).toBeNull();
  });

  it("throws when a name matches more than one layer", () => {
    const ambiguous = compileLayers([
      { layer: "shared", packages: "@repo/shared-*" },
      { layer: "generic", packages: "@repo/*" },
    ]);
    expect(() => resolveLayerForPackageName("@repo/shared-lint-config", ambiguous)).toThrow(
      /matches multiple layers/,
    );
  });
});

describe("findNearestPackageName", () => {
  it("walks up to the nearest package.json (this package's own)", () => {
    expect(findNearestPackageName(thisDir)).toBe("@repo/shared-lint-config");
  });
});

describe("layer-boundaries rule", () => {
  const currentFile = resolve(thisDir, "layer-boundaries.ts"); // lives in @repo/shared-lint-config -> layer "shared"

  it("allows importing from a lower layer", () => {
    // "shared" (the real @repo/shared-lint-config) is index 0 in the default LAYERS, so to
    // exercise the "importing from below" path we put a fictitious layer under it. Only the
    // current file's own layer touches real fs; the bare-specifier import target below is
    // resolved by pattern alone, so no fixture package needs to exist on disk.
    const layersWithLayerBelowShared: LayerConfig[] = [
      { layer: "core", packages: "@repo/core-*" },
      { layer: "shared", packages: "@repo/shared-*", allowSameLayerImports: true },
    ];
    const { context, messages } = createFakeContext(currentFile, layersWithLayerBelowShared);
    const visitor = rule.create(context);
    visitor.ImportDeclaration({ source: { type: "StringLiteral", value: "@repo/core-utils" } });
    expect(messages).toEqual([]);
  });

  it("allows same-layer imports when allowSameLayerImports is true", () => {
    const { context, messages } = createFakeContext(currentFile, LAYERS);
    const visitor = rule.create(context);
    visitor.ImportDeclaration({
      source: { type: "StringLiteral", value: "@repo/shared-typescript-config" },
    });
    expect(messages).toEqual([]);
  });

  it("reports importing from a higher layer", () => {
    const { context, messages } = createFakeContext(currentFile, LAYERS);
    const visitor = rule.create(context);
    visitor.ImportDeclaration({ source: { type: "StringLiteral", value: "@repo/domain-hosts" } });
    expect(messages).toEqual([
      '"@repo/shared-lint-config" (layer "shared") must not import "@repo/domain-hosts" (layer "domains") - layers may only import from layers below them.',
    ]);
  });

  it("reports same-layer imports when allowSameLayerImports is false (default)", () => {
    const { context, messages } = createFakeContext(currentFile, [
      { layer: "shared", packages: "@repo/shared-*" },
    ]);
    const visitor = rule.create(context);
    visitor.ImportDeclaration({
      source: { type: "StringLiteral", value: "@repo/shared-typescript-config" },
    });
    expect(messages).toEqual([
      '"@repo/shared-lint-config" (layer "shared") must not import "@repo/shared-typescript-config" - packages within layer "shared" cannot import each other.',
    ]);
  });

  it("ignores external (non-workspace) packages", () => {
    const { context, messages } = createFakeContext(currentFile, LAYERS);
    const visitor = rule.create(context);
    visitor.ImportDeclaration({ source: { type: "StringLiteral", value: "effect" } });
    expect(messages).toEqual([]);
  });

  it("ignores self-imports of the current package", () => {
    const { context, messages } = createFakeContext(currentFile, LAYERS);
    const visitor = rule.create(context);
    visitor.ImportDeclaration({
      source: { type: "StringLiteral", value: "@repo/shared-lint-config" },
    });
    expect(messages).toEqual([]);
  });

  it("allows a same-layer relative import across real packages when allowSameLayerImports is true", () => {
    const { context, messages } = createFakeContext(currentFile, LAYERS);
    const visitor = rule.create(context);
    const relativeToTypescriptConfig = "../../../typescript-config/package.json";
    visitor.ImportDeclaration({
      source: { type: "StringLiteral", value: relativeToTypescriptConfig },
    });
    expect(messages).toEqual([]);
  });

  it("checks re-exports and dynamic imports too", () => {
    const { context, messages } = createFakeContext(currentFile, LAYERS);
    const visitor = rule.create(context);
    visitor.ExportNamedDeclaration({ source: { value: "@repo/domain-hosts" } });
    visitor.ExportAllDeclaration({
      source: { type: "StringLiteral", value: "@repo/domain-hosts" },
    });
    visitor.ImportExpression({ source: { type: "StringLiteral", value: "@repo/domain-hosts" } });
    expect(messages).toHaveLength(3);
  });
});
