CREATE TABLE `atelier_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`builds_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atelier_collections_token_hash_unique` ON `atelier_collections` (`token_hash`);--> statement-breakpoint
CREATE TABLE `atelier_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`description` text NOT NULL,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atelier_journal` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`title` text NOT NULL,
	`stage` text NOT NULL,
	`note` text NOT NULL,
	`image` text NOT NULL,
	`video_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atelier_journal_request` ON `atelier_journal` (`request_id`);--> statement-breakpoint
CREATE TABLE `atelier_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atelier_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`count` integer NOT NULL,
	`day` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atelier_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`options_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atelier_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`build_json` text NOT NULL,
	`message` text NOT NULL,
	`details_json` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`order_id` text,
	`serial` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atelier_requests_token_hash_unique` ON `atelier_requests` (`token_hash`);--> statement-breakpoint
CREATE INDEX `atelier_requests_created` ON `atelier_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `atelier_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atelier_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`story` text NOT NULL,
	`build_json` text NOT NULL,
	`image` text NOT NULL,
	`video_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atelier_stories_request_id_unique` ON `atelier_stories` (`request_id`);--> statement-breakpoint
CREATE TABLE `atelier_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`voter_hash` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atelier_votes_poll` ON `atelier_votes` (`poll_id`);