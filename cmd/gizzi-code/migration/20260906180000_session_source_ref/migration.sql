ALTER TABLE `session` ADD `source_harness` text;--> statement-breakpoint
ALTER TABLE `session` ADD `source_session_id` text;--> statement-breakpoint
ALTER TABLE `session` ADD `source_path` text;--> statement-breakpoint
ALTER TABLE `session` ADD `source_snapshot_hash` text;--> statement-breakpoint
ALTER TABLE `session` ADD `source_snapshot_at` integer;--> statement-breakpoint
ALTER TABLE `session` ADD `source_event_id` text;--> statement-breakpoint
ALTER TABLE `session` ADD `source_native_hash` text;--> statement-breakpoint
ALTER TABLE `session` ADD `source_fetched_hash` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_source_idx` ON `session` (`source_harness`,`source_session_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `session_source_event` (
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_id` text,
	`kind` text NOT NULL,
	`role` text,
	`text` text,
	`tool_name` text,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `sequence`),
	CONSTRAINT `fk_session_source_event_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_source_event_session_idx` ON `session_source_event` (`session_id`);
