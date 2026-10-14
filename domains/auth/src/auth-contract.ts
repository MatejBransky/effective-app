import { AuthContract } from "@yielded/auth";
import { Schema } from "effect";

export const AuthApi = AuthContract.make("app/Auth", {
  claims: Schema.Struct({ displayName: Schema.String }),
  actions: (sessions) => ({ signIn: AuthContract.passwordSignIn(sessions) }),
});
