import { registry } from "@effective-app/shared-lib";
import { Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";

export interface Keybinding {
  /** e.g. `"mod+k"`, `"shift+mod+p"`, `"escape"` - `+`-separated, `mod` is the platform's
   * primary modifier (Cmd on macOS, Ctrl elsewhere), composable with `shift`/`alt`. The
   * last segment is compared against `event.key` (case-insensitively). */
  readonly keys: string;
  readonly handler: (event: KeyboardEvent) => void;
}

interface RegisteredKeybinding extends Keybinding {
  readonly id: string;
}

/**
 * `Atom.keepAlive` is required here, not optional - every atom defaults to
 * `keepAlive: false` (`effect/unstable/reactivity`'s `AtomRegistry.createNode` schedules an
 * unmounted atom for removal on the very next tick unless something is actively subscribed
 * via `useAtomValue`/`registry.subscribe`). This atom is managed purely imperatively
 * (`registerKeybinding`/`useGlobalKeybindings` below only ever call `registry.get`/`update`,
 * never `useAtomValue`), so without `keepAlive` every registration would be silently wiped
 * back to `[]` moments after being written - confirmed by tracing `AtomRegistry.ts`'s
 * `createNode`/`scheduleAtomRemoval` after registered keybindings mysteriously stopped firing.
 */
const keybindingsAtom: Atom.Writable<ReadonlyArray<RegisteredKeybinding>> = Atom.keepAlive(
  Atom.make<ReadonlyArray<RegisteredKeybinding>>([]),
);

/** Registers a global shortcut from anywhere in the component tree. Returns an unregister
 * function - call it on unmount (e.g. from a `useEffect` cleanup) so the binding doesn't
 * outlive the component that registered it. */
export const registerKeybinding = (binding: Keybinding): (() => void) => {
  const id = crypto.randomUUID();
  registry.update(keybindingsAtom, (list) => [...list, { ...binding, id }]);
  return () => registry.update(keybindingsAtom, (list) => list.filter((b) => b.id !== id));
};

const isMac = (): boolean => /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The subset of `KeyboardEvent` `matchesKeybinding` actually needs - a real `KeyboardEvent`
 * satisfies this structurally, and tests can pass a plain object instead of needing a DOM
 * environment (this repo's vitest runs in plain Node, no jsdom). */
export interface KeyboardEventLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/** Exact modifier-state match (not "at least") - `"k"` only fires with no modifiers held,
 * `"mod+k"` only with exactly the platform modifier held, so distinct bindings never both
 * match the same keypress. */
export const matchesKeybinding = (pattern: string, event: KeyboardEventLike): boolean => {
  const parts = pattern.toLowerCase().split("+");
  const key = parts.at(-1);
  const modPressed = isMac() ? event.metaKey : event.ctrlKey;

  return (
    modPressed === parts.includes("mod") &&
    event.shiftKey === parts.includes("shift") &&
    event.altKey === parts.includes("alt") &&
    event.key.toLowerCase() === key
  );
};

/** Runs every currently-registered binding matching `event` - reads `keybindingsAtom` fresh
 * via `registry.get` rather than closing over a snapshot, so `useGlobalKeybindings` below
 * never needs to re-subscribe its DOM listener when bindings change. Exported (separately
 * from the `useEffect` wiring) so tests can exercise real dispatch without a DOM/React render. */
export const dispatchKeydown = (event: KeyboardEvent): void => {
  for (const binding of registry.get(keybindingsAtom)) {
    if (matchesKeybinding(binding.keys, event)) {
      binding.handler(event);
    }
  }
};

/** Mount once in the app shell - installs the single global `keydown` listener. */
export const useGlobalKeybindings = (): void => {
  useEffect(() => {
    window.addEventListener("keydown", dispatchKeydown);
    return () => window.removeEventListener("keydown", dispatchKeydown);
  }, []);
};
