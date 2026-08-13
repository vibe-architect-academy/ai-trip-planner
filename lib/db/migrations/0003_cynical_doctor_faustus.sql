ALTER TABLE "trips" ADD COLUMN "state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "shared_at" timestamp with time zone;