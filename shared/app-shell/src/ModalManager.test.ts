import { AtomRegistryService } from "@repo/shared-lib";
import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { beforeEach, describe, expect, it } from "vitest";
import { closeModal, modalStackAtom, openModal } from "./ModalManager.ts";

// A fresh registry per test - real isolation (openModal/closeModal require
// AtomRegistryService rather than reaching for a shared module-level instance), not a
// reset of shared state like this file used to need.
let registry: AtomRegistry.AtomRegistry;

const run = <A, E>(effect: Effect.Effect<A, E, AtomRegistryService>): A =>
  Effect.runSync(Effect.provideService(effect, AtomRegistryService, registry));

beforeEach(() => {
  registry = AtomRegistry.make();
});

describe("openModal/closeModal", () => {
  it("starts empty", () => {
    expect(registry.get(modalStackAtom)).toEqual([]);
  });

  it("pushes a modal onto the stack", () => {
    run(openModal(() => "content"));

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });

  it("replaces the current modal by default, not stacking", () => {
    run(openModal(() => "first"));
    const second = run(openModal(() => "second"));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([second.id]);
  });

  it("stacks when { stack: true } is passed", () => {
    const first = run(openModal(() => "first"));
    const second = run(openModal(() => "second", { stack: true }));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([first.id, second.id]);
  });

  it("removes only the closed modal, keeping the rest, when stacked", () => {
    const first = run(openModal(() => "first"));
    const second = run(openModal(() => "second", { stack: true }));

    run(closeModal(first.id));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([second.id]);
  });

  it("lets a modal close itself via its own handle", () => {
    const handle = run(openModal(() => "content"));

    handle.close();

    expect(registry.get(modalStackAtom)).toEqual([]);
  });

  it("closing an unknown id is a no-op", () => {
    run(openModal(() => "content"));

    run(closeModal("does-not-exist"));

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });

  it("survives past the next tick with no active subscriber", async () => {
    // Regression test: every Atom defaults to `keepAlive: false`, so without
    // `Atom.keepAlive` on `modalStackAtom` (see its definition), the registry schedules an
    // unmounted node for removal on the very next tick - resetting it back to `[]` here,
    // since nothing in this test subscribes via `useAtomValue`. Only a synchronous
    // read-right-after-write (like the tests above) would miss that regression.
    run(openModal(() => "content"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registry.get(modalStackAtom)).toHaveLength(1);
  });
});

describe("locked modals", () => {
  it("refuses to be replaced by a later default openModal call", () => {
    const locked = run(openModal(() => "locked", { locked: true }));
    run(openModal(() => "second"));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([locked.id]);
  });

  it("refuses to be covered even by a stacked openModal call", () => {
    const locked = run(openModal(() => "locked", { locked: true }));
    run(openModal(() => "second", { stack: true }));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([locked.id]);
  });

  it("allows new modals again once the locked one is closed", () => {
    const locked = run(openModal(() => "locked", { locked: true }));
    run(closeModal(locked.id));

    const second = run(openModal(() => "second"));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([second.id]);
  });
});

describe("restorePrevious modals", () => {
  it("suspends (not discards) whatever was open, without needing the other modal's cooperation", () => {
    const first = run(openModal(() => "first"));
    const second = run(openModal(() => "second", { restorePrevious: true }));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([first.id, second.id]);
  });

  it("hides the suspended modal from the rendered stack", () => {
    const first = run(openModal(() => "first"));
    run(openModal(() => "second", { restorePrevious: true }));

    const stack = registry.get(modalStackAtom);
    expect(stack.find((entry) => entry.id === first.id)?.hidden).toBe(true);
  });

  it("restores the suspended modal (un-hidden) once it closes", () => {
    const first = run(openModal(() => "first"));
    const second = run(openModal(() => "second", { restorePrevious: true }));

    run(closeModal(second.id));

    const stack = registry.get(modalStackAtom);
    expect(stack.map((entry) => entry.id)).toEqual([first.id]);
    expect(stack[0]?.hidden).toBeFalsy();
  });

  it("is a no-op suspension when nothing was open before it", () => {
    const only = run(openModal(() => "only", { restorePrevious: true }));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([only.id]);
  });

  it("is discarded along with what it suspended if a later default openModal call replaces it", () => {
    run(openModal(() => "first"));
    run(openModal(() => "second", { restorePrevious: true }));
    const third = run(openModal(() => "third"));

    expect(registry.get(modalStackAtom).map((entry) => entry.id)).toEqual([third.id]);
  });
});
