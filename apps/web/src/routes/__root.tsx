import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { ModalHost, ShellProvider, SidebarHost } from "@repo/shared-shell";
import { Navbar } from "../components/Navbar.tsx";
import type { AuthState } from "../lib/auth.ts";
import { runtime } from "../runtime/runtime.ts";

export interface RouterContext {
  readonly auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <ShellProvider runtime={runtime}>
      <Navbar />
      <Outlet />
      <SidebarHost />
      <ModalHost />
    </ShellProvider>
  ),
});
