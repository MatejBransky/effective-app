-- Returns the assigned coach for a client, bypassing RLS (SECURITY DEFINER runs
-- as the migration owner). Coaching `coach_read` policies call this instead of
-- a self-referencing `exists` subquery on `client_profiles`, which Postgres
-- would evaluate recursively forever. `SET search_path` pins resolution so a
-- caller-controlled `search_path` cannot redirect the table reference.
CREATE OR REPLACE FUNCTION coaching_coach_of(owner_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coach_id FROM client_profiles WHERE user_id = owner_id
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION coaching_coach_of(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION coaching_coach_of(text) TO app_user;--> statement-breakpoint
ALTER POLICY "coach_read" ON "client_profiles" TO public USING (coaching_coach_of("client_profiles"."user_id") = current_setting('app.user_id', true));--> statement-breakpoint
ALTER POLICY "coach_read" ON "listening_progress" TO public USING (coaching_coach_of("listening_progress"."user_id") = current_setting('app.user_id', true));--> statement-breakpoint
ALTER POLICY "coach_read" ON "push_deliveries" TO public USING (coaching_coach_of("push_deliveries"."user_id") = current_setting('app.user_id', true));--> statement-breakpoint
ALTER POLICY "coach_read" ON "slot_completions" TO public USING (coaching_coach_of("slot_completions"."user_id") = current_setting('app.user_id', true));
