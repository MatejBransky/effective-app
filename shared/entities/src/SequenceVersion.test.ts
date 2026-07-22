import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { HostId, MarketingSequenceId, SequenceVersionId } from "./Id.ts";
import { SequenceVersion } from "./SequenceVersion.ts";
import { asId } from "./testHelpers.ts";

describe("SequenceVersion", () => {
  it("round-trips decode/encode for an original version", async () => {
    const asserts = new TestSchema.Asserts(SequenceVersion);
    const encoded = {
      id: "66666666-6666-4666-8666-666666666666",
      sequenceId: "11111111-1111-4111-8111-111111111111",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      snapshot: {
        name: "Welcome series",
        triggerType: "member_created",
        isEnabled: true,
        actions: [],
        edges: [],
      },
      revertedFromVersionId: null,
      actorType: "host_user" as const,
      actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      createdAt: "2024-07-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<SequenceVersionId>(encoded.id),
      sequenceId: asId<MarketingSequenceId>(encoded.sequenceId),
      hostId: asId<HostId>(encoded.hostId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });

  it("round-trips decode/encode for a revert-created version", async () => {
    const asserts = new TestSchema.Asserts(SequenceVersion);
    const encoded = {
      id: "77777777-7777-4777-8777-777777777777",
      sequenceId: "11111111-1111-4111-8111-111111111111",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      snapshot: {
        name: "Welcome series",
        triggerType: "member_created",
        isEnabled: true,
        actions: [],
        edges: [],
      },
      revertedFromVersionId: "66666666-6666-4666-8666-666666666666",
      actorType: "ai_agent" as const,
      actorId: null,
      createdAt: "2024-07-02T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<SequenceVersionId>(encoded.id),
      sequenceId: asId<MarketingSequenceId>(encoded.sequenceId),
      hostId: asId<HostId>(encoded.hostId),
      revertedFromVersionId: asId<SequenceVersionId>(encoded.revertedFromVersionId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
