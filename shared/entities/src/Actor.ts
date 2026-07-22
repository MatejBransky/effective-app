import { Schema } from "effect";

/**
 * Who/what caused a mutation - shared by `DomainEvent` and `SequenceVersion` so
 * AI-agent-triggered changes can be told apart from host-user and system actions.
 */
export const ActorType = Schema.Literals(["host_user", "ai_agent", "system"]);
export type ActorType = typeof ActorType.Type;
