import layerBoundariesRule from "./rules/layer-boundaries.ts";
import noTypeAssertionRule from "./rules/no-type-assertion.ts";

const plugin = {
  meta: {
    name: "repo",
  },
  rules: {
    "no-type-assertion": noTypeAssertionRule,
    "layer-boundaries": layerBoundariesRule,
  },
};

export default plugin;
