CREATE TABLE "daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"articles_fetched" integer DEFAULT 0 NOT NULL,
	"articles_processed" integer DEFAULT 0 NOT NULL,
	"articles_published" integer DEFAULT 0 NOT NULL,
	"articles_rejected" integer DEFAULT 0 NOT NULL,
	"total_impressions" bigint DEFAULT 0 NOT NULL,
	"total_likes" integer DEFAULT 0 NOT NULL,
	"total_retweets" integer DEFAULT 0 NOT NULL,
	"api_calls_used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_article_id" uuid,
	"score" numeric(5, 2),
	"tweet_text" text NOT NULL,
	"hashtags" text[],
	"thread_tweets" jsonb,
	"image_path" text,
	"image_source" text,
	"tone" text,
	"category" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	CONSTRAINT "processed_articles_raw_article_id_unique" UNIQUE("raw_article_id")
);
--> statement-breakpoint
CREATE TABLE "published_tweets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processed_id" uuid,
	"tweet_id" text NOT NULL,
	"tweet_url" text NOT NULL,
	"reply_tweet_id" text,
	"published_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"retweets" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"bookmarks" integer DEFAULT 0 NOT NULL,
	"profile_visits" integer DEFAULT 0 NOT NULL,
	"last_analytics_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "raw_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"full_text" text,
	"image_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"categories" text[]
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"rss_url" text,
	"scrape_url" text,
	"lang" text DEFAULT 'tr' NOT NULL,
	"reliability" integer DEFAULT 3 NOT NULL,
	"categories" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"websub_hub" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"module" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processed_articles" ADD CONSTRAINT "processed_articles_raw_article_id_raw_articles_id_fk" FOREIGN KEY ("raw_article_id") REFERENCES "public"."raw_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_tweets" ADD CONSTRAINT "published_tweets_processed_id_processed_articles_id_fk" FOREIGN KEY ("processed_id") REFERENCES "public"."processed_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_articles" ADD CONSTRAINT "raw_articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_stats_date_idx" ON "daily_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "processed_articles_status_idx" ON "processed_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processed_articles_created_at_idx" ON "processed_articles" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "published_tweets_tweet_id_idx" ON "published_tweets" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "published_tweets_published_at_idx" ON "published_tweets" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_articles_url_idx" ON "raw_articles" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_articles_url_hash_idx" ON "raw_articles" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "raw_articles_source_id_idx" ON "raw_articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "raw_articles_published_at_idx" ON "raw_articles" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_idx" ON "sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "system_logs_level_idx" ON "system_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "system_logs_module_idx" ON "system_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "system_logs_created_at_idx" ON "system_logs" USING btree ("created_at");