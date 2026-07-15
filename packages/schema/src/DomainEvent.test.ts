import { describe, it } from "@effect/vitest";
import { TestSchema } from "effect/testing";

import {
  DomainEvent,
  SequenceActionExecutedPayload,
  SequenceActionExecutionResult,
} from "./DomainEvent.ts";
import type { DomainEventId, HostId, SequenceActionId } from "./Id.ts";
import { asId } from "./testHelpers.ts";

const hostId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const aggregateId = "55555555-5555-4555-8555-555555555555";

describe("DomainEvent", () => {
  it("round-trips a generic event with an arbitrary payload", async () => {
    const asserts = new TestSchema.Asserts(DomainEvent);
    const encoded = {
      id: "99999999-9999-4999-8999-999999999999",
      hostId,
      aggregateType: "MemberHost",
      aggregateId,
      eventType: "MemberEnrolled",
      payload: { previousStatus: "lead", newStatus: "enrolled" },
      actorType: "host_user" as const,
      actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      occurredAt: "2024-08-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<DomainEventId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      occurredAt: new Date(encoded.occurredAt),
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });

  it("round-trips a DomainEvent whose payload is a SequenceActionExecutedPayload", async () => {
    const asserts = new TestSchema.Asserts(DomainEvent);
    const payload = {
      actionId: "33333333-3333-4333-8333-333333333333",
      actionType: "EMAIL" as const,
      result: {
        actionType: "EMAIL" as const,
        messageId: "msg_123",
        sentAt: "2024-08-01T00:00:00.000Z",
        provider: "mailpit",
      },
    };
    const encoded = {
      id: "99999999-9999-4999-8999-999999999999",
      hostId,
      aggregateType: "SequenceEnrollment",
      aggregateId,
      eventType: "SequenceActionExecuted",
      payload,
      actorType: "system" as const,
      actorId: null,
      occurredAt: "2024-08-01T00:00:00.000Z",
    };
    const decoded = {
      ...encoded,
      id: asId<DomainEventId>(encoded.id),
      hostId: asId<HostId>(encoded.hostId),
      occurredAt: new Date(encoded.occurredAt),
    };

    // `payload` is `Schema.Unknown` at the DomainEvent level - it decodes/encodes as-is here.
    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });
});

describe("SequenceActionExecutedPayload", () => {
  it("round-trips an EMAIL/SMS result", async () => {
    const asserts = new TestSchema.Asserts(SequenceActionExecutedPayload);
    const encoded = {
      actionId: "33333333-3333-4333-8333-333333333333",
      actionType: "SMS" as const,
      result: {
        actionType: "SMS" as const,
        messageId: "msg_456",
        sentAt: "2024-08-01T00:00:00.000Z",
        provider: "twilio",
      },
    };
    const decoded = {
      ...encoded,
      actionId: asId<SequenceActionId>(encoded.actionId),
      result: { ...encoded.result, sentAt: new Date(encoded.result.sentAt) },
    };

    await asserts.decoding().succeed(encoded, decoded);
    await asserts.encoding().succeed(decoded, encoded);
  });

  it("round-trips a CONDITION result", async () => {
    const asserts = new TestSchema.Asserts(SequenceActionExecutedPayload);
    const value = {
      actionId: "33333333-3333-4333-8333-333333333333",
      actionType: "CONDITION" as const,
      result: { actionType: "CONDITION" as const, branchTaken: "true" as const },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips a TAG_ADD/TAG_REMOVE result", async () => {
    const asserts = new TestSchema.Asserts(SequenceActionExecutedPayload);
    const value = {
      actionId: "33333333-3333-4333-8333-333333333333",
      actionType: "TAG_REMOVE" as const,
      result: { actionType: "TAG_REMOVE" as const, tagId: "88888888-8888-4888-8888-888888888888" },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });
});

describe("SequenceActionExecutionResult", () => {
  it("exposes guards for pattern matching on actionType", () => {
    const emailResult = {
      actionType: "EMAIL" as const,
      messageId: "msg_123",
      sentAt: new Date("2024-08-01T00:00:00.000Z"),
      provider: "mailpit",
    };

    if (!SequenceActionExecutionResult.guards.EMAIL(emailResult)) {
      throw new Error("expected EMAIL guard to match");
    }
  });
});
