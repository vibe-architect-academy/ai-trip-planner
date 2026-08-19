CREATE TABLE "previews" (
	"id" text PRIMARY KEY NOT NULL,
	"destination" text NOT NULL,
	"day_count" integer NOT NULL,
	"raw_itinerary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "previews_expires_at_idx" ON "previews" USING btree ("expires_at");