import { registry } from "@effective-app/shared-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { closeModal, modalStackAtom, openModal } from "./ModalManager.ts";

beforeEach(() => {
  // modalStackAtom is a module-level singleton shared across every test in this process -
  // reset it so one test's open modals can't leak into the next.
  registry.set(modalStackAtom, []);
});

describe("openModal/closeModal", () => {
  it("starts empty", () => {
    expect(registry.get(modalStackAtom)).toEqual([]);
  });

  it("pushes a modal onto the stack", () => {
    openModal(() => "content");

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });

  it("stacks multiple modals in open order", () => {
    const first = openModal(() => "first");
    const second = openModal(() => "second");

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([first.id, second.id]);
  });

  it("removes only the closed modal, keeping the rest", () => {
    const first = openModal(() => "first");
    const second = openModal(() => "second");

    closeModal(first.id);

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([second.id]);
  });

  it("lets a modal close itself via its own handle", () => {
    const handle = openModal(() => "content");

    handle.close();

    expect(registry.get(modalStackAtom)).toEqual([]);
  });

  it("closing an unknown id is a no-op", () => {
    openModal(() => "content");

    closeModal("does-not-exist");

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });

  it("survives past the next tick with no active subscriber", async () => {
    // Regression test: every Atom defaults to `keepAlive: false`, so without
    // `Atom.keepAlive` on `modalStackAtom` (see its definition), the registry schedules an
    // unmounted node for removal on the very next tick - resetting it back to `[]` here,
    // since nothing in this test subscribes via `useAtomValue`. Only a synchronous
    // read-right-after-write (like the tests above) would miss that regression.
    openModal(() => "content");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });
});
