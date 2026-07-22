import { registerKeybinding } from "@repo/shared-app-shell";
import { registry, runtime } from "@repo/shared-lib";
import { RegistryContext } from "@effect/atom-react";
import { PowerSyncContext } from "@powersync/react";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { completeLogin, isLoginCallback, listenForLogoutInOtherTabs } from "./lib/auth";
import { appKeybindings } from "./lib/appShell/keybindings.tsx";
import { db } from "./lib/powersync/database.ts";
import { routeTree } from "./routeTree.gen";

// Every tab listens from startup, not just after its own login - a *different* tab's
// logout needs to reach tabs that never call `logout()` themselves.
listenForLogoutInOtherTabs();

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  // The redirect back from Keycloak lands on `redirect_uri` (this app's root) with
  // `?code=...&state=...` - finish that exchange before the router renders anything, so
  // `_authenticated.tsx`'s guard sees an already-resolved session instead of racing it.
  if (isLoginCallback()) {
    await completeLogin();
  }

  // Global keybindings are registered once, here, before the first render - independent of
  // whether `Sidebar.tsx` (or anything else) ever mounts. `registry.get(runtime)` is a plain
  // imperative atom read (same as reading any other atom outside a component) - see
  // `@repo/shared-lib`'s `runtime` for why this needs no separate Context/provider.
  const context = AsyncResult.getOrThrow(registry.get(runtime));
  for (const keybinding of appKeybindings) {
    Effect.runSync(Effect.provide(registerKeybinding(keybinding), context));
  }

  const rootElement = document.getElementById("root")!;
  if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <StrictMode>
        {/* Provides our single app-wide registry (see @repo/shared-lib) to
            @effect/atom-react's hooks - without this, hooks would silently fall back to
            RegistryContext's own default standalone registry instead of the one
            ModalManager/Keybindings/syncAtoms.ts read and write imperatively. `runtime`
            (also from @repo/shared-lib) rides this same registry - no second provider
            needed for shared-app-shell's own mechanisms. */}
        <RegistryContext.Provider value={registry}>
          <PowerSyncContext.Provider value={db}>
            <RouterProvider router={router} />
          </PowerSyncContext.Provider>
        </RegistryContext.Provider>
      </StrictMode>,
    );
  }
}

void bootstrap();
