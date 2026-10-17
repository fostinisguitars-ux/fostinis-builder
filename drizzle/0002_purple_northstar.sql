CREATE TABLE `merchant_setup_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`setup_id` text NOT NULL,
	`position` integer NOT NULL,
	`ciphertext_fragment` text NOT NULL,
	FOREIGN KEY (`setup_id`) REFERENCES `merchant_setup_envelopes`(`id`) ON UPDATE no action ON DELETE cascade
);
