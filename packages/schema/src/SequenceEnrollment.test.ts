import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { HostId, MarketingSequenceId, MemberId, SequenceEnrollmentId } from "./Id.ts";
import { SequenceEnrollment } from "./SequenceEnrollment.ts";
import { asId } from "./testHelpers.ts";

describe("SequenceEnrollment", () => {
  it("round-trips decode/encode for a finished enrollment", async () => {
    const asserts = new TestSchema.Asserts(SequenceEnrollment);
    const encoded = {
      id: "55555555-5555-4555-8555-555555555555",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sequenceId: "11111111-1111-4111-8111-111111111111",
      memberId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      triggeredAt: "2024-06-01T00:00:00.000Z",
      finishedAt: "2024-06-05T00:00:00.000Z",
      cancelledAt: null,
    };
    const decoded = {
      ...encoded,
      id: asId<SequenceEnrollmentId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      sequenceId: asId<MarketingSequenceId>(encoded.sequenceId),
      memberId: asId<MemberId>(encoded.memberId),
      triggeredAt: new Date(encoded.triggeredAt),
      finishedAt: new Date(encoded.finishedAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });

  it("round-trips decode/encode for an in-flight enrollment", async () => {
    const asserts = new TestSchema.Asserts(SequenceEnrollment);
    const encoded = {
      id: "55555555-5555-4555-8555-555555555555",
      hostId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sequenceId: "11111111-1111-4111-8111-111111111111",
      memberId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      triggeredAt: "2024-06-01T00:00:00.000Z",
      finishedAt: null,
      cancelledAt: null,
    };
    const decoded = {
      ...encoded,
      id: asId<SequenceEnrollmentId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      sequenceId: asId<MarketingSequenceId>(encoded.sequenceId),
      memberId: asId<MemberId>(encoded.memberId),
      triggeredAt: new Date(encoded.triggeredAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
