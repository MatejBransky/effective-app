import { PowerSyncContext } from "@powersync/react";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { completeLogin, isLoginCallback } from "./lib/auth";
import { db } from "./lib/powersync/database.ts";
import { routeTree } from "./routeTree.gen";

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
        <PowerSyncContext.Provider value={db}>
          <RouterProvider router={router} />
        </PowerSyncContext.Provider>
      </StrictMode>,
    );
  }
}

void bootstrap();
