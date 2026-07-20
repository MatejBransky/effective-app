import { ModalHost, useGlobalKeybindings } from "@effective-app/shared-app-shell";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  // Mounted at the outermost layout (not `_authenticated`) so modals/shortcuts work on
  // pre-login routes too, e.g. `/login`.
  useGlobalKeybindings();
  return (
    <>
      <Outlet />
      <ModalHost />
      <TanStackRouterDevtools />
    </>
  );
}
