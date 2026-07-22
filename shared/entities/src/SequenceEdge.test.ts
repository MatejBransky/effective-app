import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import { SequenceEdge } from "./SequenceEdge.ts";

describe("SequenceEdge", () => {
  it("round-trips an unconditional edge", async () => {
    const asserts = new TestSchema.Asserts(SequenceEdge);
    const value = {
      id: "22222222-2222-4222-8222-222222222222",
      sequenceId: "11111111-1111-4111-8111-111111111111",
      fromActionId: "33333333-3333-4333-8333-333333333333",
      toActionId: "44444444-4444-4444-8444-444444444444",
      conditionBranch: null,
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips a conditional branch edge", async () => {
    const asserts = new TestSchema.Asserts(SequenceEdge);
    const value = {
      id: "22222222-2222-4222-8222-222222222222",
      sequenceId: "11111111-1111-4111-8111-111111111111",
      fromActionId: "33333333-3333-4333-8333-333333333333",
      toActionId: "44444444-4444-4444-8444-444444444444",
      conditionBranch: "true" as const,
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });
});
