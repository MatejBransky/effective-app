import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchKeydown,
  matchesKeybinding,
  registerKeybinding,
  type KeyboardEventLike,
} from "./Keybindings.ts";

const event = (overrides: Partial<KeyboardEventLike>): KeyboardEventLike => ({
  key: "",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

const stubPlatform = (platform: string) => {
  vi.stubGlobal("navigator", { platform, userAgent: platform });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("matchesKeybinding", () => {
  it("matches a bare key with no modifiers held", () => {
    expect(matchesKeybinding("k", event({ key: "k" }))).toBe(true);
  });

  it("does not match a bare key when an unrelated modifier is held", () => {
    expect(matchesKeybinding("k", event({ key: "k", shiftKey: true }))).toBe(false);
  });

  it("is case-insensitive on the key itself", () => {
    expect(matchesKeybinding("K", event({ key: "k" }))).toBe(true);
  });

  it("does not match when the key differs", () => {
    expect(matchesKeybinding("k", event({ key: "j" }))).toBe(false);
  });

  describe("on macOS", () => {
    it("maps 'mod' to metaKey (Cmd), not ctrlKey", () => {
      stubPlatform("MacIntel");

      expect(matchesKeybinding("mod+k", event({ key: "k", metaKey: true }))).toBe(true);
      expect(matchesKeybinding("mod+k", event({ key: "k", ctrlKey: true }))).toBe(false);
    });
  });

  describe("on Windows/Linux", () => {
    it("maps 'mod' to ctrlKey, not metaKey", () => {
      stubPlatform("Win32");

      expect(matchesKeybinding("mod+k", event({ key: "k", ctrlKey: true }))).toBe(true);
      expect(matchesKeybinding("mod+k", event({ key: "k", metaKey: true }))).toBe(false);
    });
  });

  it("composes 'mod' with 'shift'", () => {
    stubPlatform("Win32");

    expect(
      matchesKeybinding("shift+mod+p", event({ key: "p", ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(matchesKeybinding("shift+mod+p", event({ key: "p", ctrlKey: true }))).toBe(false);
  });

  it("requires an exact modifier match, not just 'at least'", () => {
    stubPlatform("Win32");

    // "k" alone shouldn't match if mod happens to be held too - avoids two bindings
    // ("k" and "mod+k") both firing on the same keypress.
    expect(matchesKeybinding("k", event({ key: "k", ctrlKey: true }))).toBe(false);
  });
});

describe("registerKeybinding/dispatchKeydown", () => {
  it("calls the handler for a matching keypress", () => {
    stubPlatform("Win32");
    const handler = vi.fn();
    const unregister = registerKeybinding({ keys: "mod+k", handler });

    dispatchKeydown(event({ key: "k", ctrlKey: true }) as KeyboardEvent);

    expect(handler).toHaveBeenCalledOnce();
    unregister();
  });

  it("does not call the handler for a non-matching keypress", () => {
    stubPlatform("Win32");
    const handler = vi.fn();
    const unregister = registerKeybinding({ keys: "mod+k", handler });

    dispatchKeydown(event({ key: "j", ctrlKey: true }) as KeyboardEvent);

    expect(handler).not.toHaveBeenCalled();
    unregister();
  });

  it("stops firing once unregistered", () => {
    stubPlatform("Win32");
    const handler = vi.fn();
    const unregister = registerKeybinding({ keys: "mod+k", handler });
    unregister();

    dispatchKeydown(event({ key: "k", ctrlKey: true }) as KeyboardEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  it("survives past the next tick with no active subscriber", async () => {
    // Regression test: every Atom defaults to `keepAlive: false`, so without
    // `Atom.keepAlive` on `keybindingsAtom` (see its definition), the registry schedules an
    // unmounted node for removal on the very next tick - resetting it back to `[]` here,
    // since nothing in this test subscribes via `useAtomValue`. A synchronous
    // dispatch-right-after-register (like the tests above) would miss that regression.
    stubPlatform("Win32");
    const handler = vi.fn();
    const unregister = registerKeybinding({ keys: "mod+k", handler });

    await new Promise((resolve) => setTimeout(resolve, 0));
    dispatchKeydown(event({ key: "k", ctrlKey: true }) as KeyboardEvent);

    expect(handler).toHaveBeenCalledOnce();
    unregister();
  });
});
