CREATE TABLE `merchant_setup_envelopes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`envelope_json` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
