CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"position" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"position" integer NOT NULL,
	"heading" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"destination" text NOT NULL,
	"day_count" integer NOT NULL,
	"title" text,
	"raw_itinerary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_day_position_idx" ON "activities" USING btree ("day_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "days_trip_position_idx" ON "days" USING btree ("trip_id","position");--> statement-breakpoint
CREATE INDEX "trips_user_id_created_at_idx" ON "trips" USING btree ("user_id","created_at");