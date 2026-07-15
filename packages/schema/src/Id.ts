import { Schema } from "effect";

/**
 * All ids are client-generated UUIDs (hard PowerSync requirement - every synced table
 * needs a single client-generated `id` column) - see "Why client-generated UUID ids" in
 * docs/data-model.md. Branding keeps different entities' ids from being mixed up at the
 * type level even though they're all plain UUID strings on the wire.
 */
const brandedUuid = <B extends string>(brand: B) =>
  Schema.String.check(Schema.isUUID()).pipe(Schema.brand(brand));

export const HostId = brandedUuid("HostId");
export type HostId = typeof HostId.Type;

export const MemberId = brandedUuid("MemberId");
export type MemberId = typeof MemberId.Type;

export const MemberHostId = brandedUuid("MemberHostId");
export type MemberHostId = typeof MemberHostId.Type;

export const LeadStageTemplateId = brandedUuid("LeadStageTemplateId");
export type LeadStageTemplateId = typeof LeadStageTemplateId.Type;

export const LeadStageId = brandedUuid("LeadStageId");
export type LeadStageId = typeof LeadStageId.Type;

export const MarketingSequenceId = brandedUuid("MarketingSequenceId");
export type MarketingSequenceId = typeof MarketingSequenceId.Type;

export const HostFilterSetId = brandedUuid("HostFilterSetId");
export type HostFilterSetId = typeof HostFilterSetId.Type;

export const SequenceActionId = brandedUuid("SequenceActionId");
export type SequenceActionId = typeof SequenceActionId.Type;

export const SequenceEdgeId = brandedUuid("SequenceEdgeId");
export type SequenceEdgeId = typeof SequenceEdgeId.Type;

export const SequenceEnrollmentId = brandedUuid("SequenceEnrollmentId");
export type SequenceEnrollmentId = typeof SequenceEnrollmentId.Type;

export const SequenceVersionId = brandedUuid("SequenceVersionId");
export type SequenceVersionId = typeof SequenceVersionId.Type;

export const DomainEventId = brandedUuid("DomainEventId");
export type DomainEventId = typeof DomainEventId.Type;
