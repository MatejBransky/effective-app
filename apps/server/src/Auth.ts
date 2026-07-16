import { Effect, Layer } from "effect";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import { CurrentHost } from "./CurrentHost.ts";
import { InvalidToken, JwtVerifier } from "./JwtVerifier.ts";

/**
 * Bearer-token auth middleware. `HttpApiSecurity.bearer` only extracts the raw
 * (redacted) credential from the Authorization header - it does not verify anything by
 * itself, so the actual JWT/JWKS check happens in `AuthLive` below via `JwtVerifier`.
 */
export class Auth extends HttpApiMiddleware.Service<Auth, { provides: CurrentHost }>()(
  "effective-app/Auth",
  {
    error: InvalidToken,
    security: { bearer: HttpApiSecurity.bearer },
  },
) {}

export const AuthLive = Layer.effect(
  Auth,
  Effect.gen(function* () {
    const verifier = yield* JwtVerifier;
    return {
      bearer: (effect, opts) =>
        Effect.provideServiceEffect(effect, CurrentHost, verifier.verify(opts.credential)),
    };
  }),
);
