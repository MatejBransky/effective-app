import { setLocale } from "../../paraglide/runtime.js";

/** Applies the UI locale at runtime (no reload - atoms re-render on switch). */
export const applyLocale = (locale: "cs" | "en"): void => {
  setLocale(locale, { reload: false });
};
