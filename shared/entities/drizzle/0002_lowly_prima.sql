CREATE TABLE "client_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"bio" text,
	"focus_hour" integer NOT NULL,
	"focus_minute" integer NOT NULL,
	"time_zone" text NOT NULL,
	"locale" text NOT NULL,
	"coach_id" text
);
--> statement-breakpoint
ALTER TABLE "client_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coaching_users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaching_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "daily_contents" (
	"program_date" text NOT NULL,
	"locale" text NOT NULL,
	"focus_audio_key" text NOT NULL,
	"recharge1_audio_key" text NOT NULL,
	"recharge2_audio_key" text NOT NULL,
	CONSTRAINT "daily_contents_program_date_locale_pk" PRIMARY KEY("program_date","locale")
);
--> statement-breakpoint
ALTER TABLE "daily_contents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listening_progress" (
	"user_id" text NOT NULL,
	"program_date" text NOT NULL,
	"slot" text NOT NULL,
	"played_seconds" double precision NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"reached_end" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "listening_progress_user_id_program_date_slot_pk" PRIMARY KEY("user_id","program_date","slot")
);
--> statement-breakpoint
ALTER TABLE "listening_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_deliveries" (
	"user_id" text NOT NULL,
	"program_date" text NOT NULL,
	"slot" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "push_deliveries_user_id_program_date_slot_pk" PRIMARY KEY("user_id","program_date","slot")
);
--> statement-breakpoint
ALTER TABLE "push_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "slot_completions" (
	"user_id" text NOT NULL,
	"program_date" text NOT NULL,
	"slot" text NOT NULL,
	"listened_at" timestamp with time zone NOT NULL,
	CONSTRAINT "slot_completions_user_id_program_date_slot_pk" PRIMARY KEY("user_id","program_date","slot")
);
--> statement-breakpoint
ALTER TABLE "slot_completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_isolation" ON "client_profiles" AS PERMISSIVE FOR ALL TO public USING ("client_profiles"."user_id" = current_setting('app.user_id', true)) WITH CHECK ("client_profiles"."user_id" = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "coach_read" ON "client_profiles" AS PERMISSIVE FOR SELECT TO public USING (exists (
    select 1 from client_profiles
    where client_profiles.user_id = "client_profiles"."user_id"
    and client_profiles.coach_id = current_setting('app.user_id', true)
  ));--> statement-breakpoint
CREATE POLICY "admin_all" ON "client_profiles" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  )) WITH CHECK (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  ));--> statement-breakpoint
CREATE POLICY "user_isolation" ON "coaching_users" AS PERMISSIVE FOR ALL TO public USING ("coaching_users"."user_id" = current_setting('app.user_id', true)) WITH CHECK ("coaching_users"."user_id" = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "admin_all" ON "coaching_users" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  )) WITH CHECK (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  ));--> statement-breakpoint
CREATE POLICY "authenticated_read" ON "daily_contents" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "user_isolation" ON "listening_progress" AS PERMISSIVE FOR ALL TO public USING ("listening_progress"."user_id" = current_setting('app.user_id', true)) WITH CHECK ("listening_progress"."user_id" = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "coach_read" ON "listening_progress" AS PERMISSIVE FOR SELECT TO public USING (exists (
    select 1 from client_profiles
    where client_profiles.user_id = "listening_progress"."user_id"
    and client_profiles.coach_id = current_setting('app.user_id', true)
  ));--> statement-breakpoint
CREATE POLICY "admin_all" ON "listening_progress" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  )) WITH CHECK (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  ));--> statement-breakpoint
CREATE POLICY "user_isolation" ON "push_deliveries" AS PERMISSIVE FOR ALL TO public USING ("push_deliveries"."user_id" = current_setting('app.user_id', true)) WITH CHECK ("push_deliveries"."user_id" = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "coach_read" ON "push_deliveries" AS PERMISSIVE FOR SELECT TO public USING (exists (
    select 1 from client_profiles
    where client_profiles.user_id = "push_deliveries"."user_id"
    and client_profiles.coach_id = current_setting('app.user_id', true)
  ));--> statement-breakpoint
CREATE POLICY "admin_all" ON "push_deliveries" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  )) WITH CHECK (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  ));--> statement-breakpoint
CREATE POLICY "user_isolation" ON "push_subscriptions" AS PERMISSIVE FOR ALL TO public USING ("push_subscriptions"."user_id" = current_setting('app.user_id', true)) WITH CHECK ("push_subscriptions"."user_id" = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "admin_all" ON "push_subscriptions" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  )) WITH CHECK (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  ));--> statement-breakpoint
CREATE POLICY "user_isolation" ON "slot_completions" AS PERMISSIVE FOR ALL TO public USING ("slot_completions"."user_id" = current_setting('app.user_id', true)) WITH CHECK ("slot_completions"."user_id" = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "coach_read" ON "slot_completions" AS PERMISSIVE FOR SELECT TO public USING (exists (
    select 1 from client_profiles
    where client_profiles.user_id = "slot_completions"."user_id"
    and client_profiles.coach_id = current_setting('app.user_id', true)
  ));--> statement-breakpoint
CREATE POLICY "admin_all" ON "slot_completions" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  )) WITH CHECK (exists (
    select 1 from coaching_users
    where coaching_users.user_id = current_setting('app.user_id', true)
    and coaching_users.role = 'admin'
  ));