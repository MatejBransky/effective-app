import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { HostId, LeadStageId, MemberHostId, MemberId } from "./Id.ts";
import { MemberHost } from "./MemberHost.ts";
import { asId } from "./testHelpers.ts";

describe("MemberHost", () => {
  it("round-trips decode/encode for a lead", async () => {
    const asserts = new TestSchema.Asserts(MemberHost);
    const encoded = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      memberId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "lead" as const,
      convertedAt: null,
      leadStageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      createdAt: "2024-03-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<MemberHostId>(encoded.id),
      memberId: asId<MemberId>(encoded.memberId),
      hostId: asId<HostId>(encoded.hostId),
      leadStageId: asId<LeadStageId>(encoded.leadStageId),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });

  it("round-trips decode/encode for an enrolled member", async () => {
    const asserts = new TestSchema.Asserts(MemberHost);
    const encoded = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      memberId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "enrolled" as const,
      convertedAt: "2024-03-15T00:00:00.000Z",
      leadStageId: null,
      createdAt: "2024-03-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<MemberHostId>(encoded.id),
      memberId: asId<MemberId>(encoded.memberId),
      hostId: asId<HostId>(encoded.hostId),
      convertedAt: new Date(encoded.convertedAt),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
