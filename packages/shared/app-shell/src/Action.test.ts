import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { defineAction, resolveActionLabel } from "./Action.ts";

describe("resolveActionLabel", () => {
  it("returns a plain string label as-is", () => {
    const action = defineAction<{ id: string }>({
      id: "test",
      label: "Do the thing",
      execute: () => Effect.void,
    });

    expect(resolveActionLabel(action, { id: "1" })).toBe("Do the thing");
  });

  it("calls a function label with the given ctx", () => {
    const action = defineAction<{ name: string }>({
      id: "test",
      label: (ctx) => `Greet ${ctx.name}`,
      execute: () => Effect.void,
    });

    expect(resolveActionLabel(action, { name: "Ada" })).toBe("Greet Ada");
  });
});
