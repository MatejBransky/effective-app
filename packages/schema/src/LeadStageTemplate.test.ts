import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import { LeadStageTemplate } from "./LeadStageTemplate.ts";

describe("LeadStageTemplate", () => {
  it("round-trips decode/encode", async () => {
    const asserts = new TestSchema.Asserts(LeadStageTemplate);
    const value = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      businessType: "gym",
      name: "New lead",
      color: "#00FF00",
      order: 0,
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });
});
