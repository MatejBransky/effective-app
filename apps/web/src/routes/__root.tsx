import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Navbar } from "../components/Navbar.tsx";
import type { AuthState } from "../lib/auth.ts";

export interface RouterContext {
  readonly auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Navbar />
      <Outlet />
    </>
  ),
});
