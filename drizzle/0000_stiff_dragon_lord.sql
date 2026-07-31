CREATE TABLE `bot_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guild_configs` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`prefix` text DEFAULT '!' NOT NULL,
	`language` text
);
--> statement-breakpoint
CREATE TABLE `user_configs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`experience` integer DEFAULT 0 NOT NULL
);
