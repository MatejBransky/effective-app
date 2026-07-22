import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import { FilterRule } from "./FilterRule.ts";

describe("FilterRule", () => {
  it("round-trips a leaf condition rule", async () => {
    const asserts = new TestSchema.Asserts(FilterRule);
    const value = {
      type: "condition" as const,
      field: "leadStage",
      operator: "equals" as const,
      value: "trial",
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips a nested group rule (recursive via Schema.suspend)", async () => {
    const asserts = new TestSchema.Asserts(FilterRule);
    const value = {
      type: "group" as const,
      combinator: "and" as const,
      rules: [
        {
          type: "condition" as const,
          field: "businessType",
          operator: "equals" as const,
          value: "gym",
        },
        {
          type: "group" as const,
          combinator: "or" as const,
          rules: [
            {
              type: "condition" as const,
              field: "status",
              operator: "equals" as const,
              value: "lead",
            },
            {
              type: "condition" as const,
              field: "status",
              operator: "equals" as const,
              value: "enrolled",
            },
          ],
        },
      ],
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("rejects an unknown rule type", async () => {
    const asserts = new TestSchema.Asserts(FilterRule);
    await asserts
      .decoding()
      .fail(
        { type: "bogus", field: "x", operator: "equals", value: 1 },
        `Expected { readonly "type": "condition", ... } | { readonly "type": "group", ... }, got {"type":"bogus","field":"x","operator":"equals","value":1}`,
      );
  });
});
