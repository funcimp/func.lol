CREATE TABLE "tripwire_events" (
	"id" text PRIMARY KEY NOT NULL,
	"req_id" text,
	"event" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"path" text NOT NULL,
	"pattern" text NOT NULL,
	"ip" text NOT NULL,
	"query" text,
	"category" text,
	"bomb" text,
	"ua_raw" text,
	"ua_family" text,
	"asn" text,
	"asn_name" text,
	"blob_pathname" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tripwire_events_ts_idx" ON "tripwire_events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "tripwire_events_category_idx" ON "tripwire_events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tripwire_events_asn_idx" ON "tripwire_events" USING btree ("asn");--> statement-breakpoint
CREATE INDEX "tripwire_events_path_idx" ON "tripwire_events" USING btree ("path");