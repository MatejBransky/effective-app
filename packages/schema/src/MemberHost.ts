import { Schema } from "effect";

import { HostId, LeadStageId, MemberHostId, MemberId } from "./Id.ts";

/**
 * The binary "converted yet or not" - independent of `leadStageId`, which is "how far
 * along the funnel". See "Why status lives on MemberHost, not Member" in docs/data-model.md.
 */
export const MemberHostStatus = Schema.Literals(["lead", "enrolled"]);
export type MemberHostStatus = typeof MemberHostStatus.Type;

export const MemberHost = Schema.Struct({
  id: MemberHostId,
  memberId: MemberId,
  hostId: HostId,
  status: MemberHostStatus,
  convertedAt: Schema.NullOr(Schema.DateFromString),
  leadStageId: Schema.NullOr(LeadStageId),
  createdAt: Schema.DateFromString,
});
export type MemberHost = typeof MemberHost.Type;
export type MemberHostEncoded = typeof MemberHost.Encoded;
