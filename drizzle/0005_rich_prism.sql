CREATE TABLE `atelier_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`access_token` text NOT NULL,
	`build_json` text NOT NULL,
	`quote_json` text NOT NULL,
	`adjustments_json` text NOT NULL,
	`base_cents` integer NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`shipping_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`specification` text NOT NULL,
	`lead_time` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`order_id` text,
	`checkout_attempt` integer DEFAULT 0 NOT NULL,
	`checkout_started_at` text,
	`checkout_lock` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`issued_at` text,
	`paid_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atelier_invoices_access_token_unique` ON `atelier_invoices` (`access_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `atelier_invoice_active_request` ON `atelier_invoices` (`request_id`) WHERE "atelier_invoices"."status" != 'void';--> statement-breakpoint
CREATE TABLE `atelier_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`object_key` text NOT NULL,
	`field` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atelier_uploads_object_key_unique` ON `atelier_uploads` (`object_key`);