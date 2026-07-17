import { InMemoryWebStorage, User, UserManager, WebStorageStateStore } from "oidc-client-ts";

const KEYCLOAK_URL = import.meta.env["VITE_KEYCLOAK_URL"];
const KEYCLOAK_REALM = import.meta.env["VITE_KEYCLOAK_REALM"];
const KEYCLOAK_CLIENT_ID = import.meta.env["VITE_KEYCLOAK_CLIENT_ID"];
if (!KEYCLOAK_URL || !KEYCLOAK_REALM || !KEYCLOAK_CLIENT_ID) {
  throw new Error(
    "VITE_KEYCLOAK_URL/VITE_KEYCLOAK_REALM/VITE_KEYCLOAK_CLIENT_ID must be set - see .env.example",
  );
}

/**
 * Authorization Code + PKCE against Keycloak's `effective-app-client`
 * (`standardFlowEnabled`, public client - oidc-client-ts adds PKCE automatically since no
 * `client_secret` is configured). `directAccessGrantsEnabled` (password grant) on that
 * Keycloak client exists only for backend testing - never used from the browser.
 *
 * Token storage: in-memory only (`InMemoryWebStorage`), never `sessionStorage`/
 * `localStorage` - the OWASP-recommended pattern for SPAs, so an XSS payload can't
 * exfiltrate a token from storage after the fact (it could still read in-memory JS state
 * while executing, which no storage choice prevents). The cost: a hard page reload loses
 * the in-memory user - `restoreSession` below recovers it via a hidden-iframe silent
 * sign-in (`prompt=none`) against Keycloak's own SSO session cookie, not by persisting
 * anything client-side. See tasks/integrate-client.md's "Open decisions" for the full
 * tradeoff writeup. `automaticSilentRenew` uses the same mechanism to refresh the access
 * token before it expires, not just on reload.
 */
export const userManager = new UserManager({
  authority: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
  client_id: KEYCLOAK_CLIENT_ID,
  redirect_uri: `${window.location.origin}/`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  silent_redirect_uri: `${window.location.origin}/silent-renew.html`,
  response_type: "code",
  scope: "openid",
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
});

export const login = (): Promise<void> => userManager.signinRedirect();

/**
 * Ends the Keycloak SSO session too (`signoutRedirect`, not just a local `removeUser`) -
 * otherwise `restoreSession`'s silent renew would immediately re-authenticate the user
 * from Keycloak's still-live session cookie right after a "logout".
 */
export const logout = async (): Promise<void> => {
  await userManager.signoutRedirect();
};

export const getUser = (): Promise<User | null> => userManager.getUser();

export const getAccessToken = async (): Promise<string | null> => {
  const user = await getUser();
  return user && !user.expired ? user.access_token : null;
};

/** True once the browser has landed back on `redirect_uri` with an authorization code -
 * call `completeLogin` to finish the exchange. */
export const isLoginCallback = (): boolean => {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") && params.has("state");
};

/** Completes the Authorization Code exchange after a `signinRedirect` round-trip, then
 * strips `code`/`state` from the URL so a page refresh doesn't retry it. */
export const completeLogin = async (): Promise<User> => {
  const user = await userManager.signinRedirectCallback();
  window.history.replaceState({}, "", window.location.pathname);
  return user;
};

/** Called once at app startup (see `main.tsx`) to recover a session across a page reload
 * without ever having persisted the token - see the module-level comment above. */
export const restoreSession = async (): Promise<User | null> => {
  const existing = await getUser();
  if (existing && !existing.expired) return existing;
  try {
    return await userManager.signinSilent();
  } catch {
    return null;
  }
};
