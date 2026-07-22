import { Context } from "effect";

/** The authenticated caller, provided by the `Auth` middleware for the request's scope. */
export class CurrentUser extends Context.Service<CurrentUser, { readonly subject: string }>()(
  "app-server/CurrentUser",
) {}
