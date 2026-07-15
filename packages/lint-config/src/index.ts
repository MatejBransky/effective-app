import noTypeAssertionRule from "./rules/no-type-assertion.ts";

const plugin = {
  meta: {
    name: "repo",
  },
  rules: {
    "no-type-assertion": noTypeAssertionRule,
  },
};

export default plugin;
