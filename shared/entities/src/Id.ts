import { Schema } from "effect";

/**
 * All ids are client-generated UUIDs (hard PowerSync requirement - every synced table
 * needs a single client-generated `id` column) - see "Why client-generated UUID ids" in
 * docs/data-model.md. Branding keeps different entities' ids from being mixed up at the
 * type level even though they're all plain UUID strings on the wire.
 */
const Uuid = Schema.String.check(Schema.isUUID());

export const HostId = Uuid.pipe(Schema.brand("HostId"));
export type HostId = typeof HostId.Type;

export const MemberId = Uuid.pipe(Schema.brand("MemberId"));
export type MemberId = typeof MemberId.Type;

export const MemberHostId = Uuid.pipe(Schema.brand("MemberHostId"));
export type MemberHostId = typeof MemberHostId.Type;

export const LeadStageTemplateId = Uuid.pipe(Schema.brand("LeadStageTemplateId"));
export type LeadStageTemplateId = typeof LeadStageTemplateId.Type;

export const LeadStageId = Uuid.pipe(Schema.brand("LeadStageId"));
export type LeadStageId = typeof LeadStageId.Type;

export const MarketingSequenceId = Uuid.pipe(Schema.brand("MarketingSequenceId"));
export type MarketingSequenceId = typeof MarketingSequenceId.Type;

export const HostFilterSetId = Uuid.pipe(Schema.brand("HostFilterSetId"));
export type HostFilterSetId = typeof HostFilterSetId.Type;

export const SequenceActionId = Uuid.pipe(Schema.brand("SequenceActionId"));
export type SequenceActionId = typeof SequenceActionId.Type;

export const SequenceEdgeId = Uuid.pipe(Schema.brand("SequenceEdgeId"));
export type SequenceEdgeId = typeof SequenceEdgeId.Type;

export const SequenceEnrollmentId = Uuid.pipe(Schema.brand("SequenceEnrollmentId"));
export type SequenceEnrollmentId = typeof SequenceEnrollmentId.Type;

export const SequenceVersionId = Uuid.pipe(Schema.brand("SequenceVersionId"));
export type SequenceVersionId = typeof SequenceVersionId.Type;

export const DomainEventId = Uuid.pipe(Schema.brand("DomainEventId"));
export type DomainEventId = typeof DomainEventId.Type;
