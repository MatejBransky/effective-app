import { AuthApi } from "@repo/auth";
import { Auth, Http, Password, Sessions } from "@yielded/auth";

export const AppAuth = Auth.make(AuthApi, {
  sessions: Sessions.stateful({ maxAge: "8 hours", idleTimeout: "30 minutes" }),
  strategies: { password: Password.make() },
  defaultStrategy: "password",
});

export const AuthRoutes = Http.layer(AppAuth, {
  origin: "http://app.example.com",
});
