import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { HostFilterSetId, HostId } from "./Id.ts";
import { HostFilterSet } from "./HostFilterSet.ts";
import { asId } from "./testHelpers.ts";

describe("HostFilterSet", () => {
  it("round-trips decode/encode with a nested FilterRule tree", async () => {
    const asserts = new TestSchema.Asserts(HostFilterSet);
    const encoded = {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Active leads only",
      rules: {
        type: "group" as const,
        combinator: "and" as const,
        rules: [
          {
            type: "condition" as const,
            field: "status",
            operator: "equals" as const,
            value: "lead",
          },
        ],
      },
      createdAt: "2024-04-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<HostFilterSetId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
