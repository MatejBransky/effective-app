import { UserManager } from "oidc-client-ts";

// A minimal, config-free UserManager is enough here - `signinSilentCallback()` only
// needs to parse the current URL/postMessage response, not the full settings object
// `src/lib/auth.ts`'s real `userManager` carries (authority, client_id, ...). Keeping
// this file tiny and dependency-light matters since it's a second full page load inside
// a hidden iframe on every silent renew.
void new UserManager({ authority: "", client_id: "", redirect_uri: "" }).signinSilentCallback();
