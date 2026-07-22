import { InMemoryWebStorage, type User, UserManager, WebStorageStateStore } from "oidc-client-ts";

const authority = `${import.meta.env.VITE_KEYCLOAK_URL}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}`;

export const userManager = new UserManager({
  authority,
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  redirect_uri: window.location.origin,
  silent_redirect_uri: `${window.location.origin}/silent-renew.html`,
  response_type: "code",
  scope: "openid profile",
  // In-memory only (OWASP-recommended for SPAs): an XSS payload can't exfiltrate a token
  // from storage after the fact, since there's nothing persisted to read. Trade-off: a
  // hard reload loses the session - recovered via silent-renew.html's hidden-iframe
  // signinSilent() against Keycloak's own SSO session cookie instead.
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
});

export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly user: User | null;
  readonly login: () => Promise<void>;
  readonly logout: () => Promise<void>;
}

/** Resolves the current session before the router renders - see main.tsx. */
export async function resolveAuth(): Promise<AuthState> {
  let user = await userManager.getUser();
  if (!user || user.expired) {
    user = await userManager.signinSilent().catch(() => null);
  }
  return {
    isAuthenticated: user != null && !user.expired,
    user,
    login: () => userManager.signinRedirect(),
    // `AuthState` is a snapshot resolved once at boot (see main.tsx) - it doesn't
    // reactively update on logout, so force a full reload rather than a client-side
    // route change. `login()` already goes through an equivalent full navigation (the
    // Keycloak redirect), so this keeps both transitions consistent.
    logout: async () => {
      await userManager.removeUser();
      window.location.assign("/login");
    },
  };
}
