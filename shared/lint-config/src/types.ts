export interface RuleContext {
  report: (opts: { node: unknown; message: string; fix?: (fixer: Fixer) => Fix }) => void;
  getSourceCode: () => SourceCode;
}

/**
 * Minimal mirror of the oxlint runtime helpers our rules use. Both helpers operate on
 * whatever node representation the caller already holds (at runtime these are always real
 * ESTree nodes) without inspecting it, so they stay polymorphic (`<Node>`, preserving the
 * caller's type) instead of naming a concrete node type or absorbing the input as
 * `unknown`. (Typing these as `ESTree.Node` was tried first and reverted: the existing
 * rule implementations pass structurally-typed visitor nodes, so a concrete parameter type
 * breaks their compile - a fix that belongs with those call sites, not this mirror.)
 */
export interface Fixer {
  replaceText: <Node>(node: Node, text: string) => Fix;
}

export interface Fix {
  range: [number, number];
  text: string;
}

export interface SourceCode {
  getText: <Node>(node: Node) => string;
}
