import { registry } from "@repo/shared-lib";
import { Effect, Fiber } from "effect";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { closeModal, modalStackAtom } from "./ModalManager.ts";
import { confirm } from "./Confirm.tsx";

beforeEach(() => {
  registry.set(modalStackAtom, []);
});

/** `entry.render(...)` returns a `<ConfirmDialog onConfirm={...} onCancel={...} />` element -
 * a plain object (`{ type, props }`) from `React.createElement`, so its callback props can be
 * invoked directly without mounting anything through a DOM renderer (this repo has no jsdom/
 * testing-library - see Keybindings.test.ts/ModalManager.test.ts for the same "no DOM needed"
 * approach applied elsewhere in this package). The handle passed to `render` must actually
 * close by id (mirroring what `ModalHost` really constructs) - a no-op `close` would make
 * `onConfirm`'s own `modalHandle.close()` call silently do nothing. */
const getModalCallbacks = (): { onConfirm: () => void; onCancel: () => void } => {
  const [entry] = registry.get(modalStackAtom);
  const element = entry!.render({
    id: entry!.id,
    close: () => closeModal(entry!.id),
  }) as ReactElement<{
    onConfirm: () => void;
    onCancel: () => void;
  }>;
  return element.props;
};

describe("confirm", () => {
  it("opens exactly one modal", () => {
    void Effect.runPromise(confirm({ title: "t", message: "m" }));

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });

  it("resolves true when confirmed", async () => {
    const promise = Effect.runPromise(confirm({ title: "t", message: "m" }));

    getModalCallbacks().onConfirm();

    expect(await promise).toBe(true);
  });

  it("resolves false when cancelled", async () => {
    const promise = Effect.runPromise(confirm({ title: "t", message: "m" }));

    getModalCallbacks().onCancel();

    expect(await promise).toBe(false);
  });

  it("closes the modal once resolved", async () => {
    const promise = Effect.runPromise(confirm({ title: "t", message: "m" }));

    getModalCallbacks().onConfirm();
    await promise;

    expect(registry.get(modalStackAtom)).toEqual([]);
  });

  it("closes the modal on interruption instead of leaving it stuck open", async () => {
    const fiber = Effect.runFork(confirm({ title: "t", message: "m" }));
    // Let the fiber actually start (registering the modal) before interrupting it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(registry.get(modalStackAtom)).toHaveLength(1);

    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(registry.get(modalStackAtom)).toEqual([]);
  });
});
