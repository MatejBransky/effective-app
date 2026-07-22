ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "host_filter_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "marketing_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_hosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sequence_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sequence_edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sequence_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "host_isolation" ON "domain_events" AS PERMISSIVE FOR ALL TO public USING ("domain_events"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("domain_events"."host_id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "hosts" AS PERMISSIVE FOR ALL TO public USING ("hosts"."id" = current_setting('app.host_id', true)) WITH CHECK ("hosts"."id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "host_filter_sets" AS PERMISSIVE FOR ALL TO public USING ("host_filter_sets"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("host_filter_sets"."host_id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "lead_stages" AS PERMISSIVE FOR ALL TO public USING ("lead_stages"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("lead_stages"."host_id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "marketing_sequences" AS PERMISSIVE FOR ALL TO public USING ("marketing_sequences"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("marketing_sequences"."host_id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation_via_join" ON "members" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from member_hosts
    where member_hosts.member_id = "members"."id"
    and member_hosts.host_id = current_setting('app.host_id', true)
  )) WITH CHECK (exists (
    select 1 from member_hosts
    where member_hosts.member_id = "members"."id"
    and member_hosts.host_id = current_setting('app.host_id', true)
  ));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "member_hosts" AS PERMISSIVE FOR ALL TO public USING ("member_hosts"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("member_hosts"."host_id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation_via_join" ON "sequence_actions" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from marketing_sequences
    where marketing_sequences.id = "sequence_actions"."sequence_id"
    and marketing_sequences.host_id = current_setting('app.host_id', true)
  )) WITH CHECK (exists (
    select 1 from marketing_sequences
    where marketing_sequences.id = "sequence_actions"."sequence_id"
    and marketing_sequences.host_id = current_setting('app.host_id', true)
  ));--> statement-breakpoint
CREATE POLICY "host_isolation_via_join" ON "sequence_edges" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from marketing_sequences
    where marketing_sequences.id = "sequence_edges"."sequence_id"
    and marketing_sequences.host_id = current_setting('app.host_id', true)
  )) WITH CHECK (exists (
    select 1 from marketing_sequences
    where marketing_sequences.id = "sequence_edges"."sequence_id"
    and marketing_sequences.host_id = current_setting('app.host_id', true)
  ));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "sequence_enrollments" AS PERMISSIVE FOR ALL TO public USING ("sequence_enrollments"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("sequence_enrollments"."host_id" = current_setting('app.host_id', true));--> statement-breakpoint
CREATE POLICY "host_isolation" ON "sequence_versions" AS PERMISSIVE FOR ALL TO public USING ("sequence_versions"."host_id" = current_setting('app.host_id', true)) WITH CHECK ("sequence_versions"."host_id" = current_setting('app.host_id', true));