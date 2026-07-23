import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { ShellHost, ShellRuntimeProvider } from "@repo/shared-shell";
import { Navbar } from "../components/Navbar.tsx";
import type { AuthState } from "../lib/auth.ts";
import { runtime } from "../runtime/runtime.ts";

export interface RouterContext {
  readonly auth: AuthState;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <ShellRuntimeProvider runtime={runtime}>
      <Navbar />
      <Outlet />
      <ShellHost />
    </ShellRuntimeProvider>
  ),
});
