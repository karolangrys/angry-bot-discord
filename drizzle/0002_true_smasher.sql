CREATE TABLE `scheduled_scripts` (
	`name` text PRIMARY KEY NOT NULL,
	`cron` text NOT NULL,
	`code` text NOT NULL,
	`channel_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_run_at` integer,
	`last_result` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `script_store` (
	`script_name` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`key`, `script_name`),
	FOREIGN KEY (`script_name`) REFERENCES `scheduled_scripts`(`name`) ON UPDATE no action ON DELETE cascade
);
