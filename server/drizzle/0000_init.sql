CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`genres` text NOT NULL,
	`image` text,
	`search_text` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL,
	`store_id` text NOT NULL,
	`raw_title` text NOT NULL,
	`variant` text NOT NULL,
	`platform` text,
	`condition` text NOT NULL,
	`format` text NOT NULL,
	`price` real NOT NULL,
	`was` real,
	`in_stock` integer NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listings_game_idx` ON `listings` (`game_id`);--> statement-breakpoint
CREATE INDEX `listings_store_idx` ON `listings` (`store_id`);--> statement-breakpoint
CREATE TABLE `raw_feeds` (
	`source_id` text PRIMARY KEY NOT NULL,
	`fetched_at` text NOT NULL,
	`item_count` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `refresh_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`results` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`base` text NOT NULL,
	`link_style` text,
	`last_fetched_at` text,
	`last_status` text,
	`last_error` text
);
