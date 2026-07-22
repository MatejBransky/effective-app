import { Effect, Layer } from "effect";
import { HttpApiError, HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import { CurrentUser } from "./CurrentUser.ts";
import { JwtVerifier } from "./JwtVerifier.ts";

/**
 * Bearer-token auth middleware. `HttpApiSecurity.bearer` only extracts the raw
 * (redacted) credential from the Authorization header - it does not verify anything by
 * itself, so the actual JWT/JWKS check happens in `AuthLive` below via `JwtVerifier`.
 */
export class Auth extends HttpApiMiddleware.Service<Auth, { provides: CurrentUser }>()(
  "app-server/Auth",
  {
    error: HttpApiError.Unauthorized,
    security: { bearer: HttpApiSecurity.bearer },
  },
) {}

export const AuthLive = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const verifier = yield* JwtVerifier;
    return {
      bearer: (effect, opts) =>
        Effect.provideServiceEffect(effect, CurrentUser, verifier.verify(opts.credential)),
    };
  }),
);
