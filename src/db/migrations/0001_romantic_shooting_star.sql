CREATE TABLE "published_instagram_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processed_id" uuid,
	"ig_media_id" text NOT NULL,
	"ig_post_url" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"last_analytics_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "processed_articles" ADD COLUMN "video_path" text;--> statement-breakpoint
ALTER TABLE "processed_articles" ADD COLUMN "platform_targets" text[];--> statement-breakpoint
ALTER TABLE "processed_articles" ADD COLUMN "instagram_caption" text;--> statement-breakpoint
ALTER TABLE "raw_articles" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "raw_articles" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "published_instagram_posts" ADD CONSTRAINT "published_instagram_posts_processed_id_processed_articles_id_fk" FOREIGN KEY ("processed_id") REFERENCES "public"."processed_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "published_ig_media_id_idx" ON "published_instagram_posts" USING btree ("ig_media_id");--> statement-breakpoint
CREATE INDEX "published_ig_published_at_idx" ON "published_instagram_posts" USING btree ("published_at");