import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { HostFilterSetId, HostId, MarketingSequenceId } from "./Id.ts";
import { MarketingSequence } from "./MarketingSequence.ts";
import { asId } from "./testHelpers.ts";

describe("MarketingSequence", () => {
  it("round-trips decode/encode with a filterSetId", async () => {
    const asserts = new TestSchema.Asserts(MarketingSequence);
    const encoded = {
      id: "11111111-1111-4111-8111-111111111111",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Welcome series",
      triggerType: "member_created",
      filterSetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      isEnabled: true,
      createdAt: "2024-05-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<MarketingSequenceId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      filterSetId: asId<HostFilterSetId>(encoded.filterSetId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });

  it("round-trips decode/encode with a null filterSetId (targets everyone)", async () => {
    const asserts = new TestSchema.Asserts(MarketingSequence);
    const encoded = {
      id: "11111111-1111-4111-8111-111111111111",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Welcome series",
      triggerType: "member_created",
      filterSetId: null,
      isEnabled: true,
      createdAt: "2024-05-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<MarketingSequenceId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
