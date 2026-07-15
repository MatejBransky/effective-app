import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "node:assert";

import { TestSchema } from "effect/testing";

import { SequenceAction } from "./SequenceAction.ts";

const sequenceId = "11111111-1111-4111-8111-111111111111";
const actionId = "33333333-3333-4333-8333-333333333333";
const tagId = "88888888-8888-4888-8888-888888888888";

describe("SequenceAction", () => {
  it("round-trips an EMAIL action", async () => {
    const asserts = new TestSchema.Asserts(SequenceAction);
    const value = {
      id: actionId,
      sequenceId,
      type: "EMAIL" as const,
      offsetMinutes: 0,
      config: { subject: "Welcome!", template: "welcome-email" },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips an SMS action", async () => {
    const asserts = new TestSchema.Asserts(SequenceAction);
    const value = {
      id: actionId,
      sequenceId,
      type: "SMS" as const,
      offsetMinutes: 60,
      config: { template: "welcome-sms" },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips a CONDITION action with a nested FilterRule", async () => {
    const asserts = new TestSchema.Asserts(SequenceAction);
    const value = {
      id: actionId,
      sequenceId,
      type: "CONDITION" as const,
      offsetMinutes: 120,
      config: {
        rule: {
          type: "condition" as const,
          field: "status",
          operator: "equals" as const,
          value: "enrolled",
        },
      },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips a TAG_ADD action", async () => {
    const asserts = new TestSchema.Asserts(SequenceAction);
    const value = {
      id: actionId,
      sequenceId,
      type: "TAG_ADD" as const,
      offsetMinutes: 0,
      config: { tagId },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("round-trips a TAG_REMOVE action", async () => {
    const asserts = new TestSchema.Asserts(SequenceAction);
    const value = {
      id: actionId,
      sequenceId,
      type: "TAG_REMOVE" as const,
      offsetMinutes: 0,
      config: { tagId },
    };

    await asserts.decoding().succeed(value);
    await asserts.encoding().succeed(value);
  });

  it("rejects a config shape that doesn't match its type", async () => {
    const asserts = new TestSchema.Asserts(SequenceAction);
    await asserts.decoding().fail(
      {
        id: actionId,
        sequenceId,
        type: "TAG_ADD",
        offsetMinutes: 0,
        config: { subject: "wrong shape", template: "x" },
      },
      `Missing key
  at ["config"]["tagId"]`,
    );
  });

  it("exposes guards and match for pattern matching", () => {
    const emailAction = {
      id: actionId,
      sequenceId,
      type: "EMAIL" as const,
      offsetMinutes: 0,
      config: { subject: "Welcome!", template: "welcome-email" },
    };

    ok(SequenceAction.guards.EMAIL(emailAction));
    ok(!SequenceAction.guards.SMS(emailAction));
    deepStrictEqual(
      SequenceAction.match(emailAction, {
        EMAIL: () => "email",
        SMS: () => "sms",
        CONDITION: () => "condition",
        TAG_ADD: () => "tag_add",
        TAG_REMOVE: () => "tag_remove",
      }),
      "email",
    );
  });
});
