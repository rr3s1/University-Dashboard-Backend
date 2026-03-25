CREATE INDEX CONCURRENTLY IF NOT EXISTS "subjects_department_id_idx" ON "subjects" USING btree ("department_id");
--> statement-breakpoint