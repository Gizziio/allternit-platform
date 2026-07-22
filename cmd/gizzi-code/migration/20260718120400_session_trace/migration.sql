CREATE TABLE `session_trace` (
  `sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `session_id` text NOT NULL,
  `kind` text NOT NULL,
  `message_id` text,
  `part_id` text,
  `data` text NOT NULL,
  `time_created` integer NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_trace_cursor_idx` ON `session_trace` (`session_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `session_trace_message_idx` ON `session_trace` (`message_id`);
