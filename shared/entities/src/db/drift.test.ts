import {
  ClientProfile,
  CoachingUser,
  DailyContent,
  DomainEvent,
  Host,
  HostFilterSet,
  LeadStage,
  LeadStageTemplate,
  ListeningProgress,
  MarketingSequence,
  Member,
  MemberHost,
  PushDelivery,
  PushSubscription,
  SequenceAction,
  SequenceEdge,
  SequenceEnrollment,
  SequenceVersion,
  SlotCompletion,
} from "../index.ts";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  clientProfiles,
  coachingUsers,
  dailyContents,
  domainEvents,
  hostFilterSets,
  hosts,
  leadStages,
  leadStageTemplates,
  marketingSequences,
  memberHosts,
  members,
  sequenceActions,
  sequenceEdges,
  sequenceEnrollments,
  sequenceVersions,
  slotCompletions,
  listeningProgress,
  pushDeliveries,
  pushSubscriptions,
} from "./schema/index.ts";

/**
 * Guards against shared/entities (Effect Schema, source of truth) and shared/db
 * (hand-written Drizzle tables) drifting apart - see "Effect Schema -> Drizzle bridge"
 * in docs/data-model.md for why this is a drift test rather than codegen.
 *
 * `SequenceAction` is a discriminated union in shared/entities but one flat table here
 * (its `config` shape depends on `type` at the application layer, not the DB layer), so
 * its field set is read from any one case - every case shares the same top-level keys.
 */
const entities = [
  { name: "Host", fields: Object.keys(Host.fields), table: hosts },
  { name: "Member", fields: Object.keys(Member.fields), table: members },
  { name: "MemberHost", fields: Object.keys(MemberHost.fields), table: memberHosts },
  {
    name: "LeadStageTemplate",
    fields: Object.keys(LeadStageTemplate.fields),
    table: leadStageTemplates,
  },
  { name: "LeadStage", fields: Object.keys(LeadStage.fields), table: leadStages },
  { name: "HostFilterSet", fields: Object.keys(HostFilterSet.fields), table: hostFilterSets },
  {
    name: "MarketingSequence",
    fields: Object.keys(MarketingSequence.fields),
    table: marketingSequences,
  },
  {
    name: "SequenceAction",
    fields: Object.keys(SequenceAction.cases.EMAIL.fields),
    table: sequenceActions,
  },
  { name: "SequenceEdge", fields: Object.keys(SequenceEdge.fields), table: sequenceEdges },
  {
    name: "SequenceEnrollment",
    fields: Object.keys(SequenceEnrollment.fields),
    table: sequenceEnrollments,
  },
  { name: "SequenceVersion", fields: Object.keys(SequenceVersion.fields), table: sequenceVersions },
  { name: "DomainEvent", fields: Object.keys(DomainEvent.fields), table: domainEvents },
  { name: "CoachingUser", fields: Object.keys(CoachingUser.fields), table: coachingUsers },
  { name: "ClientProfile", fields: Object.keys(ClientProfile.fields), table: clientProfiles },
  { name: "DailyContent", fields: Object.keys(DailyContent.fields), table: dailyContents },
  {
    name: "SlotCompletion",
    fields: Object.keys(SlotCompletion.fields),
    table: slotCompletions,
  },
  {
    name: "ListeningProgress",
    fields: Object.keys(ListeningProgress.fields),
    table: listeningProgress,
  },
  {
    name: "PushSubscription",
    fields: Object.keys(PushSubscription.fields),
    table: pushSubscriptions,
  },
  { name: "PushDelivery", fields: Object.keys(PushDelivery.fields), table: pushDeliveries },
];

describe("Effect Schema <-> Drizzle drift", () => {
  it.each(entities)("$name: schema fields match table columns", ({ fields, table }) => {
    const columns = Object.keys(getTableColumns(table));
    expect([...columns].sort()).toEqual([...fields].sort());
  });
});
