CREATE TABLE "domain_events" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"email" text NOT NULL,
	"time_zone" text NOT NULL,
	"currency" text NOT NULL,
	"business_type" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "hosts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "host_filter_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"order" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_stage_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"business_type" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_sequences" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"filter_set_id" text,
	"is_enabled" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone_number" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_hosts" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"host_id" text NOT NULL,
	"status" text NOT NULL,
	"converted_at" timestamp with time zone,
	"lead_stage_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_hosts_member_id_host_id_unique" UNIQUE("member_id","host_id")
);
--> statement-breakpoint
CREATE TABLE "sequence_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence_id" text NOT NULL,
	"type" text NOT NULL,
	"offset_minutes" integer NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence_id" text NOT NULL,
	"from_action_id" text NOT NULL,
	"to_action_id" text NOT NULL,
	"condition_branch" text
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"sequence_id" text NOT NULL,
	"member_id" text NOT NULL,
	"triggered_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sequence_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence_id" text NOT NULL,
	"host_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reverted_from_version_id" text,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_filter_sets" ADD CONSTRAINT "host_filter_sets_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stages" ADD CONSTRAINT "lead_stages_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_sequences" ADD CONSTRAINT "marketing_sequences_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_sequences" ADD CONSTRAINT "marketing_sequences_filter_set_id_host_filter_sets_id_fk" FOREIGN KEY ("filter_set_id") REFERENCES "public"."host_filter_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_hosts" ADD CONSTRAINT "member_hosts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_hosts" ADD CONSTRAINT "member_hosts_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_hosts" ADD CONSTRAINT "member_hosts_lead_stage_id_lead_stages_id_fk" FOREIGN KEY ("lead_stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_actions" ADD CONSTRAINT "sequence_actions_sequence_id_marketing_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."marketing_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_edges" ADD CONSTRAINT "sequence_edges_sequence_id_marketing_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."marketing_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_edges" ADD CONSTRAINT "sequence_edges_from_action_id_sequence_actions_id_fk" FOREIGN KEY ("from_action_id") REFERENCES "public"."sequence_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_edges" ADD CONSTRAINT "sequence_edges_to_action_id_sequence_actions_id_fk" FOREIGN KEY ("to_action_id") REFERENCES "public"."sequence_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_marketing_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."marketing_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_versions" ADD CONSTRAINT "sequence_versions_sequence_id_marketing_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."marketing_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_versions" ADD CONSTRAINT "sequence_versions_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_versions" ADD CONSTRAINT "sequence_versions_reverted_from_version_id_sequence_versions_id_fk" FOREIGN KEY ("reverted_from_version_id") REFERENCES "public"."sequence_versions"("id") ON DELETE no action ON UPDATE no action;