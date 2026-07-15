import type { RuleContext } from "../types.ts";

const bannedTypes = new Set(["TSAnyKeyword", "TSNeverKeyword", "TSUnknownKeyword"]);

const rule = {
  meta: {
    type: "problem",
    fixable: "code" as const,
    docs: {
      description: "Disallow as any, as never, and as unknown assertions.",
    },
  },
  create(context: RuleContext) {
    const sourceCode = context.getSourceCode();

    return {
      TSAsExpression(node: { typeAnnotation: { type: string }; expression: unknown }) {
        if (bannedTypes.has(node.typeAnnotation.type)) {
          context.report({
            node,
            message: "Do not assert to any, never, or unknown. Fix the type or use generics.",
            fix(fixer) {
              return fixer.replaceText(node, sourceCode.getText(node.expression));
            },
          });
        }
      },
      TSTypeAssertion(node: { typeAnnotation: { type: string }; expression: unknown }) {
        if (bannedTypes.has(node.typeAnnotation.type)) {
          context.report({
            node,
            message: "Do not assert to any, never, or unknown. Fix the type or use generics.",
            fix(fixer) {
              return fixer.replaceText(node, sourceCode.getText(node.expression));
            },
          });
        }
      },
    };
  },
};

export default rule;
