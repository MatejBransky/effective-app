import { defineConfig } from "@inlang/paraglide-js";

export default defineConfig({
  outdir: "./src/paraglide",
  emitTsDeclarations: true,
  // `cookie` first so `setLocale()` persists the choice (e.g. from the
  // coaching profile) across `getLocale()` calls - without a stateful
  // strategy in this list, `setLocale` is a no-op and the browser language
  // wins every time.
  strategy: ["cookie", "preferredLanguage", "baseLocale"],
});
