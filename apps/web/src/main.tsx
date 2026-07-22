import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import "./index.css";
import { resolveAuth, userManager } from "./lib/auth.ts";
import { routeTree } from "./routeTree.gen.ts";

// Landing back from Keycloak's redirect (?code=&state=) - complete the exchange before
// resolving auth state / rendering anything.
if (new URLSearchParams(window.location.search).has("code")) {
  await userManager.signinRedirectCallback();
  window.history.replaceState({}, document.title, window.location.pathname);
}

const auth = await resolveAuth();

const router = createRouter({ routeTree, context: { auth } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
