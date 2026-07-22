import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import { Host } from "./Host.ts";
import type { HostId } from "./Id.ts";
import { asId } from "./testHelpers.ts";

describe("Host", () => {
  it("round-trips decode/encode", async () => {
    const asserts = new TestSchema.Asserts(Host);
    const encoded = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Acme Gym",
      slug: "acme-gym",
      email: "hello@acme.test",
      timeZone: "America/New_York",
      currency: "USD",
      businessType: "gym",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<HostId>(encoded.id),
      createdAt: new Date(encoded.createdAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});
