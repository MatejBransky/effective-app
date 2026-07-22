import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { HostId, LeadStageId } from "./Id.ts";
import { LeadStage } from "./LeadStage.ts";
import { asId } from "./testHelpers.ts";

describe("LeadStage", () => {
  it("round-trips decode/encode", async () => {
    const asserts = new TestSchema.Asserts(LeadStage);
    const encoded = {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "New lead",
      color: null,
      order: 0,
      createdAt: "2024-01-05T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<LeadStageId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
