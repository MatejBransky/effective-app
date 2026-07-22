import { userManager } from "./lib/auth.ts";

userManager.signinSilentCallback().catch((error: unknown) => {
  console.error("Silent renew failed", error);
});
