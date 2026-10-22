CREATE TABLE "instagram_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"article_ids" uuid[] NOT NULL,
	"video_path" text NOT NULL,
	"caption" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"ig_media_id" text,
	"ig_post_url" text,
	"published_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processed_articles" ADD COLUMN "translated_title" text;--> statement-breakpoint
ALTER TABLE "processed_articles" ADD COLUMN "included_in_digest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "instagram_digests_status_idx" ON "instagram_digests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "instagram_digests_created_at_idx" ON "instagram_digests" USING btree ("created_at");