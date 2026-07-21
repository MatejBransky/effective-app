import { registry } from "@repo/shared-lib";
import { RegistryContext } from "@effect/atom-react";
import { PowerSyncContext } from "@powersync/react";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { completeLogin, isLoginCallback, listenForLogoutInOtherTabs } from "./lib/auth";
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

  const rootElement = document.getElementById("root")!;
  if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <StrictMode>
        {/* Provides our single app-wide registry (see @repo/shared-lib) to
            @effect/atom-react's hooks - without this, hooks would silently fall back to
            RegistryContext's own default standalone registry instead of the one
            ModalManager/Keybindings/syncAtoms.ts read and write imperatively. */}
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
