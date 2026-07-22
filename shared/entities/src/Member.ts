import { Schema } from "effect";

import { MemberId } from "./Id.ts";

export const Member = Schema.Struct({
  id: MemberId,
  email: Schema.String,
  firstName: Schema.NullOr(Schema.String),
  lastName: Schema.NullOr(Schema.String),
  phoneNumber: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
});
export type Member = typeof Member.Type;
export type MemberEncoded = typeof Member.Encoded;
