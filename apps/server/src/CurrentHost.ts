import { Context } from "effect";
import type { VerifiedToken } from "./JwtVerifier.ts";

/** The authenticated caller, provided by the `Auth` middleware for the request's scope. */
export class CurrentHost extends Context.Service<CurrentHost, VerifiedToken>()(
  "effective-app/CurrentHost",
) {}
