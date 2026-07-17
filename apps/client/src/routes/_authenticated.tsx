import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { StatusBar } from "../components/StatusBar.tsx";
import { db } from "../lib/powersync/database.ts";
import { logout, restoreSession } from "../lib/auth";

/**
 * Pathless layout route - guards every route nested under it (see `_authenticated.index.tsx`).
 * `restoreSession` first tries the in-memory user, then a hidden-iframe silent sign-in
 * against Keycloak's SSO cookie (survives a page reload without ever persisting a
 * token - see `src/lib/auth.ts`), only redirecting to `/login` if both come back empty.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const user = await restoreSession();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();

  const handleLogout = async () => {
    // Clears the local SQLite replica before the redirect - without this, a different
    // host logging in on the same browser afterwards would briefly see the previous
    // host's synced rows until the new sync catches up.
    await db.disconnectAndClear();
    await logout();
  };

  return (
    <>
      <p>
        Logged in as {user.profile.preferred_username ?? user.profile.email ?? user.profile.sub}{" "}
        <button type="button" onClick={() => void handleLogout()}>
          Log out
        </button>
      </p>
      {/* Persists across every child route below - only <Outlet /> changes on navigation. */}
      <nav>
        <Link to="/">Home</Link> <Link to="/about">About</Link>
      </nav>
      <StatusBar />
      <Outlet />
    </>
  );
}
