import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import type { MemberId } from "./Id.ts";
import { Member } from "./Member.ts";
import { asId } from "./testHelpers.ts";

describe("Member", () => {
  it("round-trips decode/encode", async () => {
    const asserts = new TestSchema.Asserts(Member);
    const encoded = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      email: "alice@example.test",
      firstName: "Alice",
      lastName: null,
      phoneNumber: null,
      createdAt: "2024-02-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<MemberId>(encoded.id),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
