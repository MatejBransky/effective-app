import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Redacted } from "effect";
import * as jose from "jose";
import { JwtVerifier, layerWithJwks } from "./JwtVerifier.ts";

const issuer = "http://localhost:8180/realms/app";

const { publicKey, privateKey } = await jose.generateKeyPair("RS256");
const jwks: jose.JSONWebKeySet = { keys: [await jose.exportJWK(publicKey)] };
const TestLayer = layerWithJwks({ issuer, jwks });

const sign = (claims: Record<string, unknown>, options?: { readonly expiresIn?: string }) =>
  new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setExpirationTime(options?.expiresIn ?? "1h")
    .sign(privateKey);

describe("JwtVerifier", () => {
  it.effect("extracts the subject from a valid token", () =>
    Effect.gen(function* () {
      const token = yield* Effect.promise(() => sign({ sub: "test-host" }));
      const verifier = yield* JwtVerifier;
      const result = yield* verifier.verify(Redacted.make(token));
      assert.deepStrictEqual(result, { subject: "test-host" });
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects an expired token", () =>
    Effect.gen(function* () {
      const token = yield* Effect.promise(() => sign({ sub: "test-host" }, { expiresIn: "-1h" }));
      const verifier = yield* JwtVerifier;
      const exit = yield* Effect.exit(verifier.verify(Redacted.make(token)));
      assert.isTrue(Exit.isFailure(exit));
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects a token from a different issuer", () =>
    Effect.gen(function* () {
      const token = yield* Effect.promise(() =>
        new jose.SignJWT({ sub: "test-host" })
          .setProtectedHeader({ alg: "RS256" })
          .setIssuedAt()
          .setIssuer("http://localhost:8180/realms/some-other-realm")
          .setExpirationTime("1h")
          .sign(privateKey),
      );
      const verifier = yield* JwtVerifier;
      const exit = yield* Effect.exit(verifier.verify(Redacted.make(token)));
      assert.isTrue(Exit.isFailure(exit));
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects a token missing the sub claim", () =>
    Effect.gen(function* () {
      const token = yield* Effect.promise(() => sign({}));
      const verifier = yield* JwtVerifier;
      const exit = yield* Effect.exit(verifier.verify(Redacted.make(token)));
      assert.isTrue(Exit.isFailure(exit));
    }).pipe(Effect.provide(TestLayer)),
  );
});
